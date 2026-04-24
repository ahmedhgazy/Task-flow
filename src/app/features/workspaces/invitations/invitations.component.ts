import { Component, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceInvitation } from '../../../core/models/board.model';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-invitations',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './invitations.component.html',
  styleUrl: './invitations.component.css'
})
export class InvitationsComponent implements OnInit {
  invitations = signal<WorkspaceInvitation[]>([]);
  loading = signal(true);
  private destroyRef = inject(DestroyRef);
  
  // Track action state for specific invitation token
  processingToken = signal<string | null>(null);
  currentAction = signal<'accept' | 'reject' | null>(null);

  constructor(
    private workspaceService: WorkspaceService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInvitations();
  }

  loadInvitations(): void {
    this.loading.set(true);
    this.workspaceService.getMyInvitations().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (invites) => {
        this.invitations.set(invites);
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open('Failed to load invitations', 'Close', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  accept(invite: WorkspaceInvitation): void {
    this.processingToken.set(invite.token);
    this.currentAction.set('accept');
    
    this.workspaceService.acceptInvitation(invite.token)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.processingToken.set(null);
        this.currentAction.set(null);
      }))
      .subscribe({
        next: () => {
          this.snackBar.open(`Joined ${invite.workspaceName} successfully!`, 'Close', { duration: 4000 });
          // Remove from list
          this.invitations.update(list => list.filter(i => i.token !== invite.token));
          // Navigate to the newly joined workspace after a short delay
          setTimeout(() => {
            this.router.navigate(['/workspaces', invite.workspaceId]);
          }, 1000);
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Failed to accept invitation', 'Close', { duration: 4000 });
        }
      });
  }

  reject(invite: WorkspaceInvitation): void {
    if (!confirm(`Are you sure you want to decline the invitation to ${invite.workspaceName}?`)) {
      return;
    }

    this.processingToken.set(invite.token);
    this.currentAction.set('reject');

    this.workspaceService.rejectInvitation(invite.token)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.processingToken.set(null);
        this.currentAction.set(null);
      }))
      .subscribe({
        next: () => {
          this.snackBar.open(`Invitation declined.`, 'Close', { duration: 3000 });
          // Remove from list
          this.invitations.update(list => list.filter(i => i.token !== invite.token));
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Failed to reject invitation', 'Close', { duration: 4000 });
        }
      });
  }
}
