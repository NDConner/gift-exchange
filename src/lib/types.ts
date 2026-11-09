export type Priority = 1 | 2 | 3;

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: "Would love it",
  2: "Would like it",
  3: "Nice extra",
};

export const OCCASIONS = ["Christmas", "Birthday", "Just because", "Wedding", "Baby", "Graduation"];

export type ListStatus = "draft" | "shared";
export type ClaimStatus = "planning" | "purchased";

export type RichText = { html: string; text: string } | null;

export interface LinkMeta {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

export interface ItemLink {
  url: string;
  label?: string | null;
  link_meta?: LinkMeta | null;
}

export interface ItemOption {
  id: string;
  item_id: string;
  name: string | null;
  url: string | null;
  link_meta: LinkMeta | null;
  note: string | null;
  image_url: string | null;
  position: number;
  created_at: string;
}

// Draft option in the editor (id present once saved).
export interface ItemOptionInput {
  id?: string;
  name?: string | null;
  url?: string | null;
  link_meta?: LinkMeta | null;
  note?: string | null;
  image_url?: string | null;
}

export interface WishList {
  id: string;
  owner_id: string;
  title: string;
  occasion: string | null;
  status: ListStatus;
  public_share_token: string | null;
  ai_summary: unknown | null;
  ai_summary_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  title: string;
  description: RichText;
  url: string | null;
  link_meta: LinkMeta | null;
  links: ItemLink[];
  image_url: string | null;
  options: ItemOption[];
  priority: Priority;
  quantity: number;
  position: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: string;
  item_id: string;
  option_id: string | null;
  claimer_id: string | null; // null when redacted (an anonymous claim by someone else)
  quantity: number;
  status: ClaimStatus;
  anonymous: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Comment {
  id: string;
  list_id: string;
  item_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
}

export interface ListShare {
  id: string;
  list_id: string;
  shared_with_user_id: string | null;
  shared_with_email: string | null;
  shared_with_group_id: string | null;
  source: "invite" | "link";
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  owner_id: string;
  is_public: boolean;
  join_token: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: "owner" | "member";
  status: "invited" | "active";
  created_at: string;
}

export interface SantaExchange {
  id: string;
  group_id: string;
  organizer_id: string;
  name: string;
  status: "draft" | "assigned";
  created_at: string;
  assigned_at: string | null;
}

export interface SantaParticipant {
  id: string;
  exchange_id: string;
  user_id: string;
  team: string | null;
  created_at: string;
}

export interface SantaRule {
  id: string;
  exchange_id: string;
  from_team: string;
  to_team: string;
}

export interface SantaExclusion {
  id: string;
  exchange_id: string;
  giver_user_id: string;
  recipient_user_id: string;
}

export interface SantaAssignment {
  id: string;
  exchange_id: string;
  giver_user_id: string;
  recipient_user_id: string;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  email: string;
  contact_user_id: string | null;
  display_name: string | null;
  created_at: string;
}

export type GiftStatus = "idea" | "purchased" | "wrapped" | "given";

export const GIFT_STATUS_LABELS: Record<GiftStatus, string> = {
  idea: "Idea",
  purchased: "Purchased",
  wrapped: "Wrapped",
  given: "Given",
};

export type RecipientStatus = "in_progress" | "complete";
export type GiftKind = "full" | "stocking";

export interface GiftRecipient {
  id: string;
  user_id: string;
  year: number;
  name: string;
  group_label: string | null;
  linked_list_id: string | null;
  budget: number | null;
  status: RecipientStatus;
  clue_hunt: boolean;
  position: number;
  created_at: string;
}

export interface GiftPurchase {
  id: string;
  user_id: string;
  recipient_id: string;
  claim_id: string | null;
  name: string | null;
  amount: number | null;
  status: GiftStatus;
  kind: GiftKind;
  clue_hunt: boolean;
  position: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "item_changed" | "option_changed" | "list_shared" | "item_added";
  list_id: string | null;
  item_id: string | null;
  option_id: string | null;
  title: string | null;
  body: string;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
}
