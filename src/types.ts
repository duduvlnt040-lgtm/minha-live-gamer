export type Role = 'admin' | 'user';

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  isAdmin: boolean;
  isSuspended?: boolean;
  tiktokUsername?: string;
  createdAt: number;
}

export interface UserAccess {
  hasAccess: boolean;
  isAdmin: boolean;
  isSubscribed: boolean;
  isTrial: boolean;
  trialHoursLeft: number;
  trialDaysLeft: number;
  trialExpiresAt?: number;
  subscription?: {
    id: string;
    plan_name: string;
    amount: number;
    status: string;
    started_at?: number;
    expires_at?: number;
  };
  status: 'admin_lifetime' | 'active_subscription' | 'trial_active' | 'trial_expired' | 'unauthenticated';
  message: string;
}

export interface Game {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  version: string;
  type: 'zip' | 'link';
  entry_path: string;
  directory: string | null;
  cover_image: string;
  thumbnail_image?: string;
  is_active: number | boolean;
  is_featured: number | boolean;
  is_validated?: number | boolean;
  order_index: number;
  created_at: number;
  updated_at?: number;
  userSettings?: Record<string, any>;
  userTriggers?: GameTrigger[];
}

export interface GameTrigger {
  id: string;
  name: string;
  event_type: 'gift' | 'comment' | 'like' | 'follow' | 'share';
  filter_value?: string;
  min_value: number;
  action: string;
  duration: number;
  is_active: number | boolean;
}

export interface GlobalMusic {
  id: string;
  name: string;
  artist: string;
  category: string;
  cover_url?: string | null;
  file_url: string;
  file_path?: string;
  default_volume: number;
  order_index: number;
  is_active: number | boolean;
  game_id?: string | null;
  created_at: number;
}

export interface UserMusic {
  id: string;
  user_id: number;
  name: string;
  artist: string;
  file_url: string;
  duration?: number;
  game_id?: string | null;
  created_at: number;
}

export interface PlaylistTrackItem {
  id: string;
  name: string;
  artist: string;
  file_url: string;
  cover_url?: string | null;
  category?: string;
  default_volume?: number;
  trackType: 'global' | 'user';
  playlistTrackId?: string;
  orderIndex?: number;
  isPrimary?: boolean;
}

export interface UserPlaylist {
  id: string;
  user_id: number;
  game_id: string;
  name: string;
  is_autoplay: number | boolean;
  is_repeat: number | boolean;
  volume: number;
  created_at: number;
  updated_at: number;
}

export interface LiveStatus {
  connected: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'offline' | 'error';
  username: string;
  roomId?: string | null;
  viewerCount?: number;
  connectedAt: number | null;
  lastEventAt: number | null;
  totalEvents: number;
  eventCounts?: {
    comment: number;
    like: number;
    gift: number;
    follow: number;
    share: number;
    member?: number;
  };
  reconnectAttempt?: number;
  activeOverlayCount: number;
  errorMessage: string | null;
}

export interface LiveEvent {
  id?: string;
  type: 'gift' | 'comment' | 'like' | 'follow' | 'share' | 'member' | 'crown_bride' | 'ceremony_boost';
  user: string;
  nickname?: string;
  comment?: string;
  giftName?: string;
  giftValue?: number;
  count?: number;
  totalLikeCount?: number;
  avatarUrl?: string;
  source?: 'tiktok_live' | 'simulation';
  timestamp: number;
  simulation?: boolean;
}

export interface DatabaseStatus {
  activePrimary: 'sqlite' | 'supabase+sqlite';
  sqlite: {
    connected: boolean;
    engine: string;
    dataDir?: string;
    dbPath?: string;
    isPersistentVolume?: boolean;
    tablesCount: number;
    usersCount: number;
    gamesCount: number;
    musicCount: number;
    error: string | null;
  };
  supabase: {
    configured: boolean;
    connected: boolean;
    host: string | null;
    authHealthy: boolean;
    schemaReady: boolean;
    hasServiceRoleKey: boolean;
    hasAnonKey: boolean;
    schemaFile: string;
    error: string | null;
  };
  checkedAt: number;
}

export interface CaktoConfig {
  offer_url: string;
  product_id: string;
  offer_id: string;
  webhook_secret: string;
}

export interface AuditLogItem {
  id: number;
  userId?: number | null;
  action: string;
  details: string;
  createdAt: number;
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
}

export interface AdminMetrics {
  totalUsers: number;
  activeSubs: number;
  expiredSubs: number;
  activeTrials: number;
  publishedGames: number;
  totalGames?: number;
  totalMusic: number;
  totalUserMusic?: number;
  monthlyRevenue: number;
  liveConnections: number;
  paymentsCount: number;
  paymentsTotal: number;
  recentActivity: AuditLogItem[];
}

export interface AdminSubscriptionItem {
  id: string;
  userId: number;
  planName: string;
  amount: number;
  status: string;
  startedAt: number | null;
  expiresAt: number | null;
  transactionId: string | null;
  createdAt: number;
  updatedAt: number;
  email: string;
  displayName: string;
}

export interface AdminPaymentItem {
  id: string;
  amount: number;
  status: string;
  orderId: string | null;
  createdAt: number;
  email: string;
  displayName: string;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  trialHours: number;
  subscriptionPrice: number;
  tiktokPollingInterval: number;
  tiktokConnectorEnabled: boolean;
  supabaseUrl: string;
  allowUserMusicUpload: boolean;
  maxUserMusicSizeMb: number;
}
