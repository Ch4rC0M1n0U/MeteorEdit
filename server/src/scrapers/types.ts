export interface ProfileData {
  platform: string;
  username: string;
  displayName: string;
  bio: string;
  profileImageUrl: string;
  stats: Record<string, string | number>;
  registrationDate: string | null;
  extraImages: string[];
  rawMetadata: Record<string, any>;
}
