import { Component, OnInit, signal, ViewChild, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { BoardService } from '../../../core/services/board.service';
import { AuthService } from '../../../core/services/auth.service';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { WebhookService } from '../../../core/services/webhook.service';
import { Workspace, Board, WorkspaceMember, WorkspaceDashboard, Webhook } from '../../../core/models/board.model';
import { CreateBoardDialogComponent } from '../create-board-dialog/create-board-dialog.component';
import { environment } from '../../../../environments/environment';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-workspace-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTabsModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  templateUrl: './workspace-detail.component.html',
  styleUrl: './workspace-detail.component.css'
})
export class WorkspaceDetailComponent implements OnInit {
  workspace = signal<Workspace | null>(null);
  boards = signal<Board[]>([]);
  members = signal<WorkspaceMember[]>([]);
  loading = signal(true);
  sendingInvite = signal(false);
  activeTab = 'boards';
  private destroyRef = inject(DestroyRef);

  showInviteForm = false;
  inviteEmail = '';
  inviteRole = 'Member';

  // Analytics
  dashboard = signal<WorkspaceDashboard | null>(null);
  loadingDashboard = signal(false);
  private maxTrendValue = 1;

  // Webhooks
  webhooks = signal<Webhook[]>([]);
  showCreateWebhook = false;
  newWebhook = { url: '', secret: '', events: [] as string[] };
  allWebhookEvents = [
    'card.created', 'card.updated', 'card.deleted', 'card.moved',
    'list.created', 'list.deleted',
    'comment.added', 'member.joined'
  ];

  tabs: { key: string; label: string; count?: number }[] = [];

  private workspaceId!: string;

  constructor(
    private route: ActivatedRoute,
    private workspaceService: WorkspaceService,
    private boardService: BoardService,
    private analyticsService: AnalyticsService,
    private webhookService: WebhookService,
    private dialog: MatDialog,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.workspaceId = this.route.snapshot.paramMap.get('id')!;
    this.loadData();
  }

  private updateTabs(): void {
    this.tabs = [
      { key: 'boards', label: 'Boards', count: this.boards().length },
      { key: 'members', label: 'Members', count: this.members().length },
      { key: 'analytics', label: 'Analytics' },
      { key: 'webhooks', label: 'Webhooks' }
    ];
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'analytics' && !this.dashboard()) {
      this.loadDashboard();
    }
    if (tab === 'webhooks' && this.webhooks().length === 0) {
      this.loadWebhooks();
    }
  }

  loadData(): void {
    this.loading.set(true);

    this.workspaceService.getWorkspace(this.workspaceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (workspace) => {
        this.workspace.set(workspace);
      }
    });

    this.boardService.getWorkspaceBoards(this.workspaceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (boards) => {
        this.boards.set(boards);
        this.loading.set(false);
        this.updateTabs();
      },
      error: () => {
        this.loading.set(false);
        this.updateTabs();
      }
    });

    this.loadMembers();
  }

  loadMembers(): void {
    this.http.get<WorkspaceMember[]>(`${environment.apiUrl}/workspaces/${this.workspaceId}/members`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(members => {
        this.members.set(members);
        this.updateTabs();
      });
  }

  // Analytics
  loadDashboard(): void {
    this.loadingDashboard.set(true);
    this.analyticsService.getWorkspaceDashboard(this.workspaceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.dashboard.set(data);
        if (data.completionTrend.length > 0) {
          this.maxTrendValue = Math.max(...data.completionTrend.map(p => p.completedCount), 1);
        }
        this.loadingDashboard.set(false);
      },
      error: () => {
        this.loadingDashboard.set(false);
        this.snackBar.open('Failed to load analytics', 'Close', { duration: 3000 });
      }
    });
  }

  getBarHeight(value: number): number {
    return Math.max(5, (value / this.maxTrendValue) * 100);
  }

  // Webhooks
  loadWebhooks(): void {
    this.webhookService.getWorkspaceWebhooks(this.workspaceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (hooks) => this.webhooks.set(hooks),
      error: () => this.snackBar.open('Failed to load webhooks', 'Close', { duration: 3000 })
    });
  }

  toggleWebhookEvent(event: string): void {
    const idx = this.newWebhook.events.indexOf(event);
    if (idx >= 0) {
      this.newWebhook.events.splice(idx, 1);
    } else {
      this.newWebhook.events.push(event);
    }
  }

  createWebhook(): void {
    if (!this.newWebhook.url || this.newWebhook.events.length === 0) return;

    this.webhookService.createWebhook(this.workspaceId, {
      url: this.newWebhook.url,
      secret: this.newWebhook.secret || undefined,
      events: this.newWebhook.events
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.showCreateWebhook = false;
        this.newWebhook = { url: '', secret: '', events: [] };
        this.loadWebhooks();
        this.snackBar.open('Webhook created!', 'Close', { duration: 2000 });
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed to create webhook', 'Close', { duration: 3000 })
    });
  }

  toggleWebhookActive(webhook: Webhook): void {
    this.webhookService.updateWebhook(webhook.id, {
      url: webhook.url,
      events: webhook.events,
      isActive: !webhook.isActive
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loadWebhooks(),
      error: () => this.snackBar.open('Failed to update webhook', 'Close', { duration: 3000 })
    });
  }

  deleteWebhook(webhookId: string): void {
    if (!confirm('Delete this webhook?')) return;

    this.webhookService.deleteWebhook(webhookId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.webhooks.update(hooks => hooks.filter(h => h.id !== webhookId));
        this.snackBar.open('Webhook deleted', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to delete webhook', 'Close', { duration: 3000 })
    });
  }

  sendInvitation(): void {
    if (!this.inviteEmail) return;

    this.sendingInvite.set(true);
    this.workspaceService.inviteMember(this.workspaceId, this.inviteEmail, this.inviteRole)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(`Invitation sent securely to ${this.inviteEmail}!`, 'Close', { duration: 4000 });
          this.inviteEmail = '';
          this.showInviteForm = false;
          this.sendingInvite.set(false);
          this.loadMembers();
        },
        error: (error) => {
          this.sendingInvite.set(false);
          this.snackBar.open(error.error?.message || 'Failed to send invitation', 'Close', { duration: 5000 });
        }
      });
  }

  openCreateBoardDialog(): void {
    const dialogRef = this.dialog.open(CreateBoardDialogComponent, {
      width: '450px',
      data: { workspaceId: this.workspaceId },
      panelClass: 'dark-dialog'
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result) {
        this.loadData();
      }
    });
  }
}
