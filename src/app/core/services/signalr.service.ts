import { Injectable, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { BoardPresenceInfo, TypingEvent } from '../models/board.model';

export interface CardMovedEvent {
  cardId: string;
  fromListId: string;
  toListId: string;
  newRank: number;
  userId: string;
  userName: string;
}

export interface CardCreatedEvent {
  cardId: string;
  listId: string;
  title: string;
  rank: number;
  userId: string;
  userName: string;
}

export interface CardUpdatedEvent {
  cardId: string;
  title: string;
  description?: string;
  userId: string;
  userName: string;
}

export interface CardLockEvent {
  cardId: string;
  lockedByUserId: string;
  lockedByUserName: string;
  lockExpiration: Date;
}

export interface CardUnlockEvent {
  cardId: string;
  unlockedByUserId: string;
}

export interface ListCreatedEvent {
  listId: string;
  name: string;
  rank: number;
  userId: string;
  userName: string;
}

export interface ListMovedEvent {
  listId: string;
  newRank: number;
  userId: string;
  userName: string;
}

export interface MentionEvent {
  cardId: string;
  commentId: string;
  mentionedBy: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SignalRService implements OnDestroy {
  private hubConnection: HubConnection | null = null;
  private currentBoardId: string | null = null;

  private connectionState = new BehaviorSubject<'disconnected' | 'connecting' | 'connected'>('disconnected');
  connectionState$ = this.connectionState.asObservable();

  // Card events
  cardMoved$ = new Subject<CardMovedEvent>();
  cardCreated$ = new Subject<CardCreatedEvent>();
  cardUpdated$ = new Subject<CardUpdatedEvent>();
  cardDeleted$ = new Subject<{ cardId: string; listId: string }>();
  cardLocked$ = new Subject<CardLockEvent>();
  cardUnlocked$ = new Subject<CardUnlockEvent>();

  // List events
  listCreated$ = new Subject<ListCreatedEvent>();
  listUpdated$ = new Subject<{ listId: string; name: string }>();
  listMoved$ = new Subject<ListMovedEvent>();
  listDeleted$ = new Subject<{ listId: string }>();

  // Presence & collaboration events
  boardPresence$ = new BehaviorSubject<BoardPresenceInfo[]>([]);
  userJoined$ = new Subject<BoardPresenceInfo>();
  userLeft$ = new Subject<{ userId: string }>();
  userTyping$ = new Subject<TypingEvent>();
  mentionReceived$ = new Subject<MentionEvent>();

  constructor(private authService: AuthService) {}

  async connect(): Promise<void> {
    const token = this.authService.getAccessToken();
    if (!token) {
      console.error('No access token for SignalR');
      return;
    }

    this.connectionState.next('connecting');

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}/board`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build();

    this.registerHandlers();

    try {
      await this.hubConnection.start();
      this.connectionState.next('connected');
      console.log('SignalR connected');
    } catch (err) {
      this.connectionState.next('disconnected');
      console.error('SignalR connection error:', err);
    }
  }

  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.currentBoardId = null;
      this.connectionState.next('disconnected');
      this.boardPresence$.next([]);
    }
  }

  async joinBoard(boardId: string): Promise<void> {
    if (this.currentBoardId === boardId) return;

    if (this.currentBoardId) {
      await this.leaveBoard(this.currentBoardId);
    }

    if (this.hubConnection?.state === 'Connected') {
      await this.hubConnection.invoke('JoinBoard', boardId);
      this.currentBoardId = boardId;
    }
  }

  async leaveBoard(boardId: string): Promise<void> {
    if (this.hubConnection?.state === 'Connected') {
      await this.hubConnection.invoke('LeaveBoard', boardId);
      this.currentBoardId = null;
      this.boardPresence$.next([]);
    }
  }

  // Emit events to other clients
  async emitCardMoved(boardId: string, event: CardMovedEvent): Promise<void> {
    if (this.hubConnection?.state === 'Connected') {
      await this.hubConnection.invoke('CardMoved', boardId, event);
    }
  }

  async emitCardCreated(boardId: string, event: CardCreatedEvent): Promise<void> {
    if (this.hubConnection?.state === 'Connected') {
      await this.hubConnection.invoke('CardCreated', boardId, event);
    }
  }

  async emitCardLocked(boardId: string, event: CardLockEvent): Promise<void> {
    if (this.hubConnection?.state === 'Connected') {
      await this.hubConnection.invoke('CardLocked', boardId, event);
    }
  }

  async emitCardUnlocked(boardId: string, event: CardUnlockEvent): Promise<void> {
    if (this.hubConnection?.state === 'Connected') {
      await this.hubConnection.invoke('CardUnlocked', boardId, event);
    }
  }

  // Typing indicator (debounce on caller side)
  async emitTyping(boardId: string, cardId: string): Promise<void> {
    if (this.hubConnection?.state === 'Connected') {
      await this.hubConnection.invoke('UserTyping', boardId, cardId);
    }
  }

  // Mention notification
  async emitMention(targetUserId: string, cardId: string, commentId: string, mentionedByName: string): Promise<void> {
    if (this.hubConnection?.state === 'Connected') {
      await this.hubConnection.invoke('NotifyMention', targetUserId, cardId, commentId, mentionedByName);
    }
  }

  private registerHandlers(): void {
    if (!this.hubConnection) return;

    // Card events
    this.hubConnection.on('CardMoved', (event: CardMovedEvent) => {
      this.cardMoved$.next(event);
    });

    this.hubConnection.on('CardCreated', (event: CardCreatedEvent) => {
      this.cardCreated$.next(event);
    });

    this.hubConnection.on('CardUpdated', (event: CardUpdatedEvent) => {
      this.cardUpdated$.next(event);
    });

    this.hubConnection.on('CardDeleted', (event: { cardId: string; listId: string }) => {
      this.cardDeleted$.next(event);
    });

    this.hubConnection.on('CardLocked', (event: CardLockEvent) => {
      this.cardLocked$.next(event);
    });

    this.hubConnection.on('CardUnlocked', (event: CardUnlockEvent) => {
      this.cardUnlocked$.next(event);
    });

    // List events
    this.hubConnection.on('ListCreated', (event: ListCreatedEvent) => {
      this.listCreated$.next(event);
    });

    this.hubConnection.on('ListUpdated', (event: { listId: string; name: string }) => {
      this.listUpdated$.next(event);
    });

    this.hubConnection.on('ListMoved', (event: ListMovedEvent) => {
      this.listMoved$.next(event);
    });

    this.hubConnection.on('ListDeleted', (event: { listId: string }) => {
      this.listDeleted$.next(event);
    });

    // Presence events
    this.hubConnection.on('BoardPresenceUpdate', (users: BoardPresenceInfo[]) => {
      this.boardPresence$.next(users);
    });

    this.hubConnection.on('UserJoinedBoard', (user: BoardPresenceInfo) => {
      this.userJoined$.next(user);
      const current = this.boardPresence$.value;
      if (!current.find(u => u.connectionId === user.connectionId)) {
        this.boardPresence$.next([...current, user]);
      }
    });

    this.hubConnection.on('UserLeftBoard', (event: { userId: string }) => {
      this.userLeft$.next(event);
      const current = this.boardPresence$.value;
      this.boardPresence$.next(current.filter(u => u.userId !== event.userId));
    });

    // Typing indicators
    this.hubConnection.on('UserIsTyping', (event: TypingEvent) => {
      this.userTyping$.next(event);
    });

    // Mentions
    this.hubConnection.on('MentionReceived', (event: MentionEvent) => {
      this.mentionReceived$.next(event);
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
