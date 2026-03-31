#!/usr/bin/env python3
"""
Telegram OSINT client using Telethon.
Called from Node.js via child_process.
Actions: auth_send_code, auth_sign_in, auth_status, search, resolve_username, logout
"""
import sys
import os
import json
import asyncio
from telethon import TelegramClient, functions, types
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError, PhoneNumberInvalidError

# Read args
action = sys.argv[1] if len(sys.argv) > 1 else ''
params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

API_ID = int(params.get('apiId', os.environ.get('TELEGRAM_API_ID', '0')))
API_HASH = params.get('apiHash', os.environ.get('TELEGRAM_API_HASH', ''))
SESSION_STRING = params.get('session', '')

def output(data):
    print(json.dumps(data, ensure_ascii=False, default=str))
    sys.exit(0)

def error(msg):
    print(json.dumps({'error': str(msg)}, ensure_ascii=False))
    sys.exit(1)

async def main():
    if not API_ID or not API_HASH:
        error('API_ID and API_HASH required (configure in admin OSINT settings)')

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)
    await client.connect()

    try:
        if action == 'auth_send_code':
            phone = params.get('phone', '')
            if not phone:
                error('Phone number required')
            result = await client.send_code_request(phone)
            output({
                'phoneCodeHash': result.phone_code_hash,
                'session': client.session.save(),
            })

        elif action == 'auth_sign_in':
            phone = params.get('phone', '')
            code = params.get('code', '')
            phone_code_hash = params.get('phoneCodeHash', '')
            password = params.get('password', '')

            try:
                if password:
                    await client.sign_in(password=password)
                else:
                    await client.sign_in(phone, code, phone_code_hash=phone_code_hash)
            except SessionPasswordNeededError:
                output({
                    'needs2FA': True,
                    'session': client.session.save(),
                })
                return

            me = await client.get_me()
            output({
                'success': True,
                'session': client.session.save(),
                'user': {
                    'id': me.id,
                    'username': me.username,
                    'firstName': me.first_name,
                    'lastName': me.last_name,
                    'phone': me.phone,
                },
            })

        elif action == 'auth_status':
            if not await client.is_user_authorized():
                output({'authorized': False})
            else:
                me = await client.get_me()
                output({
                    'authorized': True,
                    'user': {
                        'id': me.id,
                        'username': me.username,
                        'firstName': me.first_name,
                        'lastName': me.last_name,
                    },
                })

        elif action == 'search':
            if not await client.is_user_authorized():
                error('Not authorized. Please connect your Telegram account first.')

            query = params.get('query', '')
            limit = int(params.get('limit', 20))

            # Search for channels/groups/users
            result = await client(functions.contacts.SearchRequest(
                q=query,
                limit=limit,
            ))

            channels = []
            for chat in result.chats:
                ch = {
                    'id': chat.id,
                    'title': getattr(chat, 'title', '') or '',
                    'username': getattr(chat, 'username', '') or '',
                    'type': 'channel' if getattr(chat, 'broadcast', False) else 'group',
                    'participantsCount': getattr(chat, 'participants_count', 0) or 0,
                    'about': '',
                }
                if ch['username']:
                    ch['url'] = f"https://t.me/{ch['username']}"
                channels.append(ch)

            users = []
            for user in result.users:
                if user.is_self:
                    continue
                users.append({
                    'id': user.id,
                    'username': user.username or '',
                    'firstName': user.first_name or '',
                    'lastName': user.last_name or '',
                    'phone': user.phone or '',
                    'url': f"https://t.me/{user.username}" if user.username else '',
                })

            output({
                'channels': channels,
                'users': users,
                'totalChannels': len(channels),
                'totalUsers': len(users),
            })

        elif action == 'search_messages':
            if not await client.is_user_authorized():
                error('Not authorized')

            query = params.get('query', '')
            peer = params.get('peer', '')  # channel username or ID
            limit = int(params.get('limit', 50))

            if peer:
                entity = await client.get_entity(peer)
                messages = []
                async for msg in client.iter_messages(entity, search=query, limit=limit):
                    messages.append({
                        'id': msg.id,
                        'date': str(msg.date),
                        'text': msg.text or '',
                        'sender': msg.sender_id,
                        'views': getattr(msg, 'views', 0),
                        'url': f"https://t.me/{peer}/{msg.id}" if isinstance(peer, str) else '',
                    })
                output({'messages': messages, 'total': len(messages)})
            else:
                # Global message search not supported without peer
                error('peer (channel username) required for message search')

        elif action == 'resolve_username':
            if not await client.is_user_authorized():
                error('Not authorized')

            username = params.get('username', '')
            if not username:
                error('Username required')

            entity = await client.get_entity(username)
            info = {
                'id': entity.id,
                'type': 'user' if isinstance(entity, types.User) else 'channel' if getattr(entity, 'broadcast', False) else 'group',
                'username': getattr(entity, 'username', '') or '',
                'title': getattr(entity, 'title', '') or '',
                'firstName': getattr(entity, 'first_name', '') or '',
                'lastName': getattr(entity, 'last_name', '') or '',
                'phone': getattr(entity, 'phone', '') or '',
                'about': '',
                'participantsCount': getattr(entity, 'participants_count', 0) or 0,
                'photo': bool(getattr(entity, 'photo', None)),
            }
            if info['username']:
                info['url'] = f"https://t.me/{info['username']}"

            # Try to get full info for about/description
            try:
                if isinstance(entity, types.User):
                    full = await client(functions.users.GetFullUserRequest(entity))
                    info['about'] = full.full_user.about or ''
                else:
                    full = await client(functions.channels.GetFullChannelRequest(entity))
                    info['about'] = full.full_chat.about or ''
                    info['participantsCount'] = full.full_chat.participants_count or 0
            except:
                pass

            output(info)

        elif action == 'phone_lookup':
            if not await client.is_user_authorized():
                error('Not authorized')

            phone = params.get('phone', '')
            if not phone:
                error('Phone number required')

            try:
                result = await client(functions.contacts.ImportContactsRequest(
                    contacts=[types.InputPhoneContact(
                        client_id=0,
                        phone=phone,
                        first_name='Lookup',
                        last_name='',
                    )]
                ))
                if result.users:
                    user = result.users[0]
                    output({
                        'found': True,
                        'id': user.id,
                        'username': user.username or '',
                        'firstName': user.first_name or '',
                        'lastName': user.last_name or '',
                        'phone': user.phone or '',
                        'url': f"https://t.me/{user.username}" if user.username else '',
                    })
                    # Clean up imported contact
                    await client(functions.contacts.DeleteContactsRequest(id=[user.id]))
                else:
                    output({'found': False})
            except Exception as e:
                output({'found': False, 'error': str(e)})

        elif action == 'logout':
            await client.log_out()
            output({'success': True})

        else:
            error(f'Unknown action: {action}')

    except PhoneNumberInvalidError:
        error('Invalid phone number format')
    except PhoneCodeInvalidError:
        error('Invalid verification code')
    except Exception as e:
        error(str(e))
    finally:
        await client.disconnect()

asyncio.run(main())
