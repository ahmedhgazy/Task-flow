import { Component, OnInit, OnDestroy, signal, computed, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BoardService } from '../../../core/services/board.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { AuthService } from '../../../core/services/auth.service';
import { SprintService } from '../../../core/services/sprint.service';
import { BoardDetail, BoardList, Card, BoardPresenceInfo, Sprint } from '../../../core/models/board.model';
import { CardDetailDialogComponent } from '../card-detail-dialog/card-detail-dialog.component';
import { CreateCardDialogComponent } from '../create-card-dialog/create-card-dialog.component';
import { CreateListDialogComponent } from '../create-list-dialog/create-list-dialog.component';
import { BoardSettingsDialogComponent } from '../board-settings-dialog/board-settings-dialog.component';
import { HeaderComponent } from '../../../shared/components/header.component';

@Component({
  selector: 'app-board-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatMenuModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressBarModule,
    HeaderComponent
  ],
  templateUrl: './board-view.component.html',
  styleUrl: './board-view.component.css'
})
export class BoardViewComponent implements OnInit, OnDestroy {
  board = signal<BoardDetail | null>(null);
  lists = signal<BoardList[]>([]);
  loading = signal(true);
  connectionState = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  editingListId = signal<string | null>(null);
  archivedLists = signal<BoardList[]>([]);
  showArchivedLists = false;
  showSprintPanel = false;
  showCreateSprint = false;
  newSprintName = '';
  newSprintGoal = '';
  sprints = signal<Sprint[]>([]);
  presence = signal<BoardPresenceInfo[]>([]);

  // Typing indicators
  typingUsersByCard = signal<Map<string, Set<string>>>(new Map());
  private typingTimeouts = new Map<string, any>();

  // Filters
  filterKeyword = signal('');

  filteredLists = computed(() => {
    const keyword = this.filterKeyword().toLowerCase();
    const lists = this.lists();

    if (!keyword) return lists;

    return lists.map(list => ({
      ...list,
      cards: list.cards.filter(c =>
        c.title.toLowerCase().includes(keyword) ||
        c.labels?.some(l => l.name.toLowerCase().includes(keyword)) ||
        c.assignees?.some(a => (a.firstName + ' ' + a.lastName).toLowerCase().includes(keyword))
      )
    }));
  });

  private destroyRef = inject(DestroyRef);
  private boardId!: string;

  constructor(
    private route: ActivatedRoute,
    private boardService: BoardService,
    private signalRService: SignalRService,
    private sprintService: SprintService,
    private dialog: MatDialog,
    private router: Router,
    public authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.boardId = this.route.snapshot.paramMap.get('id')!;
    this.loadBoard();
    this.setupSignalR();
  }

  ngOnDestroy(): void {
    this.signalRService.leaveBoard(this.boardId);
  }

  loadBoard(): void {
    this.loading.set(true);
    this.boardService.getBoard(this.boardId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (board) => {
        this.board.set(board);
        this.lists.set(board.lists);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setupSignalR(): void {
    this.connectionState.set('connecting');
    this.signalRService.connect();

    this.signalRService.connectionState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => {
      this.connectionState.set(state);
      if (state === 'connected') {
        this.signalRService.joinBoard(this.boardId);
        this.setupRealtimeListeners();
      }
    });
  }

  setupRealtimeListeners(): void {
    this.signalRService.listCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(list => {
      this.lists.update(lists => [...lists, (list as any)]);
    });

    this.signalRService.listDeleted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      this.lists.update(lists => lists.filter(l => l.id !== event.listId));
    });

    this.signalRService.cardCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadBoard());
    this.signalRService.cardDeleted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadBoard());
    this.signalRService.cardMoved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadBoard());
    this.signalRService.cardUpdated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadBoard());

    // Presence
    this.signalRService.boardPresence$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(users => {
      this.presence.set(users);
    });
  }

  drop(event: CdkDragDrop<Card[]>, listId: string): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);

      const cardId = event.container.data[event.currentIndex].id;
      const newRank = this.calculateNewRank(event.container.data, event.currentIndex);

      // Update local rank immediately to prevent jumping if re-rendered before server refresh
      event.container.data[event.currentIndex].rank = newRank;

      this.boardService.moveCard(cardId, listId, newRank).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );

      const cardId = event.container.data[event.currentIndex].id;
      const newRank = this.calculateNewRank(event.container.data, event.currentIndex);

      // Update local rank
      event.container.data[event.currentIndex].rank = newRank;

      this.boardService.moveCard(cardId, listId, newRank).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
  }

  calculateNewRank(cards: Card[], currentIndex: number): number {
    const prevCard = cards[currentIndex - 1];
    const nextCard = cards[currentIndex + 1];

    if (prevCard && nextCard) {
      return (prevCard.rank + nextCard.rank) / 2;
    }

    if (prevCard) {
       return prevCard.rank + 1000;
    }

    if (nextCard) {
       return nextCard.rank / 2;
    }

    return 1000;
  }

  connectedLists = computed(() => this.lists().map(l => 'list-' + l.id));

  openCreateListDialog(): void {
    const dialogRef = this.dialog.open(CreateListDialogComponent, {
      width: '400px',
      data: { boardId: this.boardId },
      panelClass: 'dark-dialog'
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) this.loadBoard();
    });
  }

  openCreateCardDialog(listId: string): void {
    const dialogRef = this.dialog.open(CreateCardDialogComponent, {
      width: '500px',
      data: { boardId: this.boardId, listId },
      panelClass: 'dark-dialog'
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) this.loadBoard();
    });
  }

  openCardDetail(card: Card): void {
    const dialogRef = this.dialog.open(CardDetailDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      panelClass: ['dark-dialog', 'no-padding-dialog'],
      data: { card, boardId: this.boardId, workspaceId: this.board()?.workspaceId }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) this.loadBoard();
    });
  }

  deleteList(listId: string): void {
    if(confirm('Are you sure you want to delete this list?')) {
        this.boardService.deleteList(listId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.lists.update(lists => lists.filter(l => l.id !== listId));
        });
    }
  }

  isOverdue(dateInput: Date | string): boolean {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date < new Date();
  }

  startEditListName(listId: string): void {
    this.editingListId.set(listId);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('#listNameInput');
      input?.focus();
      input?.select();
    }, 50);
  }

  saveListName(listId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newName = input.value.trim();
    const currentList = this.lists().find(l => l.id === listId);

    if (!newName) {
      this.cancelEditListName();
      return;
    }

    if (currentList && newName !== currentList.name) {
      this.boardService.updateList(listId, { name: newName }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.lists.update(lists =>
            lists.map(l => l.id === listId ? { ...l, name: newName } : l)
          );
          this.snackBar.open('List renamed!', 'Close', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('Failed to rename list', 'Close', { duration: 3000 });
        }
      });
    }

    this.editingListId.set(null);
  }

  cancelEditListName(): void {
    this.editingListId.set(null);
  }

  archiveList(listId: string): void {
    this.boardService.archiveList(listId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.lists.update(lists => lists.filter(l => l.id !== listId));
        this.snackBar.open('List archived!', 'Close', { duration: 2000 });
        this.loadArchivedLists();
      },
      error: () => {
        this.snackBar.open('Failed to archive list', 'Close', { duration: 3000 });
      }
    });
  }

  loadArchivedLists(): void {
    this.boardService.getArchivedLists(this.boardId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lists) => {
        this.archivedLists.set(lists);
      }
    });
  }

  restoreList(listId: string): void {
    this.boardService.restoreList(listId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loadBoard();
        this.loadArchivedLists();
        this.snackBar.open('List restored!', 'Close', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Failed to restore list', 'Close', { duration: 3000 });
      }
    });
  }

  archiveCard(cardId: string): void {
    this.boardService.archiveCard(cardId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.lists.update(lists =>
          lists.map(l => ({
            ...l,
            cards: l.cards.filter(c => c.id !== cardId)
          }))
        );
        this.snackBar.open('Card archived!', 'Close', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Failed to archive card', 'Close', { duration: 3000 });
      }
    });
  }

  deleteCard(cardId: string, listId: string): void {
    if (confirm('Are you sure you want to delete this card?')) {
      this.boardService.deleteCard(cardId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.lists.update(lists =>
            lists.map(l => l.id === listId
              ? { ...l, cards: l.cards.filter(c => c.id !== cardId) }
              : l
            )
          );
          this.snackBar.open('Card deleted!', 'Close', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('Failed to delete card', 'Close', { duration: 3000 });
        }
      });
    }
  }

  getCoverImage(card: Card): any {
    return card.attachments?.find(a => a.fileType.startsWith('image/'));
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'Story': return 'auto_stories';
      case 'Bug': return 'bug_report';
      case 'Epic': return 'bolt';
      default: return 'check_box_outline_blank';
    }
  }

  openBoardSettings(): void {
    if (!this.board()) return;

    const dialogRef = this.dialog.open(BoardSettingsDialogComponent, {
      width: '500px',
      panelClass: ['dark-dialog', 'no-padding-dialog'],
      data: { board: this.board() }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        this.board.set(result);
        this.snackBar.open('Board updated', 'Close', { duration: 2000 });
      }
    });
  }

  deleteBoard(): void {
    if (confirm('Are you sure you want to delete this board? This action cannot be undone.')) {
      this.boardService.deleteBoard(this.boardId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open('Board deleted', 'Close', { duration: 2000 });
          this.router.navigate(['/']);
        },
        error: () => {
          this.snackBar.open('Failed to delete board', 'Close', { duration: 3000 });
        }
      });
    }
  }

  loadSprints(): void {
    this.sprintService.getBoardSprints(this.boardId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sprints) => this.sprints.set(sprints),
      error: () => this.snackBar.open('Failed to load sprints', 'Close', { duration: 3000 })
    });
  }

  createSprint(): void {
    if (!this.newSprintName.trim()) return;

    this.sprintService.createSprint(this.boardId, {
      name: this.newSprintName.trim(),
      goal: this.newSprintGoal.trim() || undefined
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.newSprintName = '';
        this.newSprintGoal = '';
        this.showCreateSprint = false;
        this.loadSprints();
        this.snackBar.open('Sprint created!', 'Close', { duration: 2000 });
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed to create sprint', 'Close', { duration: 3000 })
    });
  }

  startSprint(sprintId: string): void {
    this.sprintService.startSprint(sprintId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loadSprints();
        this.snackBar.open('Sprint started!', 'Close', { duration: 2000 });
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed to start sprint', 'Close', { duration: 3000 })
    });
  }

  completeSprint(sprintId: string): void {
    if (!confirm('Complete this sprint? Incomplete cards will be moved to the backlog.')) return;
    this.sprintService.completeSprint(sprintId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loadSprints();
        this.loadBoard();
        this.snackBar.open('Sprint completed!', 'Close', { duration: 2000 });
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed to complete sprint', 'Close', { duration: 3000 })
    });
  }

  deleteSprint(sprintId: string): void {
    if (!confirm('Delete this sprint? Cards will be moved back to the backlog.')) return;
    this.sprintService.deleteSprint(sprintId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loadSprints();
        this.snackBar.open('Sprint deleted', 'Close', { duration: 2000 });
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed to delete sprint', 'Close', { duration: 3000 })
    });
  }

  isSomeoneTyping(cardId: string): boolean {
    const set = this.typingUsersByCard().get(cardId.toLowerCase());
    return !!set && set.size > 0;
  }

  getTypingTooltip(cardId: string): string {
    const set = this.typingUsersByCard().get(cardId.toLowerCase());
    if (!set || set.size === 0) return '';
    const users = Array.from(set);
    if (users.length === 1) return `${users[0]} is typing...`;
    return `${users.length} people are typing...`;
  }
}
