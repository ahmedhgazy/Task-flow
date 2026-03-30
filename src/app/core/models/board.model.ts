export interface Workspace {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  createdAt: Date;
  memberCount: number;
  boardCount: number;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: string;
  joinedAt: Date;
}

export interface WorkspaceInvitation {
  token: string;
  workspaceId: string;
  workspaceName: string;
  workspaceLogoUrl?: string;
  invitedByUserName: string;
  role: string;
  expiresAt: Date;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  isArchived: boolean;
  workspaceId: string;
  workspaceName?: string;
  createdAt: Date;
  listCount: number;
}

export interface BoardDetail {
  id: string;
  name: string;
  description?: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  isArchived: boolean;
  workspaceId: string;
  createdAt: Date;
  lists: BoardList[];
}

export interface BoardList {
  id: string;
  name: string;
  rank: number;
  isArchived: boolean;
  cards: Card[];
}

export interface Card {
  id: string;
  title: string;
  description?: string;
  rank: number;
  priority: CardPriority;
  type: CardType;
  storyPoints?: number;
  estimatedHours?: number;
  loggedHours: number;
  dueDate?: Date;
  isArchived: boolean;
  sprintId?: string;
  epicId?: string;
  lockedByUserId?: string;
  lockedByUserName?: string;
  lockExpiration?: Date;
  assignees: CardAssignee[];
  labels: CardLabel[];
  checklists: Checklist[];
  attachments: Attachment[];
  commentCount: number;
  watcherCount: number;
  isWatching: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  cardId: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  content: string;
  isChecked: boolean;
  position: number;
  checklistId: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  createdAt: Date;
  uploadedByUserId: string;
  uploadedByInitials: string;
}

export interface CardAssignee {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export interface CardLabel {
  id: string;
  name: string;
  color: string;
}

export interface Comment {
  id: string;
  text?: string;
  voiceNoteUrl?: string;
  voiceNoteDurationSeconds?: number;
  isVoiceNote: boolean;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: Date;
}

export enum CardPriority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Urgent = 'Urgent'
}

export enum CardType {
  Task = 'Task',
  Story = 'Story',
  Bug = 'Bug',
  Epic = 'Epic'
}

export enum SprintStatus {
  Planning = 'Planning',
  Active = 'Active',
  Completed = 'Completed'
}

// Sprint
export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate?: Date;
  endDate?: Date;
  boardId: string;
  createdAt: Date;
  cardCount: number;
  completedCardCount: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
}

export interface SprintCardSummary {
  cardId: string;
  title: string;
  type: CardType;
  priority: CardPriority;
  storyPoints?: number;
  listName: string;
  isArchived: boolean;
}

// Time Tracking
export interface TimeEntry {
  id: string;
  hours: number;
  description?: string;
  loggedAt: Date;
  cardId: string;
  userId: string;
}

// Card History
export interface CardRevision {
  id: string;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  changedAt: Date;
  cardId: string;
  userId: string;
}

// Automations
export enum AutomationTriggerType {
  CardMovedToList = 'CardMovedToList',
  CardCreated = 'CardCreated',
  LabelAdded = 'LabelAdded',
  DueDatePassed = 'DueDatePassed',
  CardAssigned = 'CardAssigned'
}

export enum AutomationActionType {
  SetLabel = 'SetLabel',
  RemoveAllAssignees = 'RemoveAllAssignees',
  SetPriority = 'SetPriority',
  MoveToList = 'MoveToList',
  SendWebhook = 'SendWebhook'
}

export interface AutomationRule {
  id: string;
  name?: string;
  triggerType: AutomationTriggerType;
  triggerValue?: string;
  actionType: AutomationActionType;
  actionValue?: string;
  isEnabled: boolean;
  boardId: string;
  createdByUserId: string;
  createdByUserName: string;
  createdAt: Date;
}

// Webhooks
export interface Webhook {
  id: string;
  url: string;
  hasSecret: boolean;
  events: string[];
  isActive: boolean;
  lastTriggeredAt?: Date;
  workspaceId: string;
  createdAt: Date;
}

// Analytics
export interface WorkspaceDashboard {
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  completionPercentage: number;
  memberWorkloads: MemberWorkload[];
  completionTrend: DailyCompletion[];
}

export interface MemberWorkload {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  assignedCards: number;
  completedCards: number;
  overdueCards: number;
}

export interface DailyCompletion {
  date: Date;
  completedCount: number;
}

export interface SprintBurndown {
  sprintId: string;
  sprintName: string;
  totalStoryPoints: number;
  dataPoints: BurndownPoint[];
}

export interface BurndownPoint {
  date: Date;
  remainingPoints: number;
}

// Real-time Presence
export interface BoardPresenceInfo {
  userId: string;
  userName: string;
  avatarUrl?: string;
  connectionId: string;
}

export interface TypingEvent {
  userId: string;
  userName: string;
  cardId: string;
}

