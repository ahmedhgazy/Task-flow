import { Component, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import { Workspace } from '../../../core/models/board.model';
import { CreateWorkspaceDialogComponent } from '../create-workspace-dialog/create-workspace-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-workspaces-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './workspaces-list.component.html',
  styleUrl: './workspaces-list.component.css'
})
export class WorkspacesListComponent implements OnInit {
  workspaces = signal<Workspace[]>([]);
  loading = signal(true);
  private destroyRef = inject(DestroyRef);

  constructor(
    private workspaceService: WorkspaceService,
    private dialog: MatDialog,
    public authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.workspaceService.getWorkspaces().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.workspaces.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getUserInitials(): string {
    const user = this.authService.currentUserValue;
    return user ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}` : '';
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CreateWorkspaceDialogComponent, {
      width: '500px',
      panelClass: 'dark-dialog'
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        this.loadWorkspaces();
      }
    });
  }

  deleteWorkspace(event: Event, id: string): void {
    event.preventDefault();
    event.stopPropagation();

    if (confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      this.workspaceService.deleteWorkspace(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.snackBar.open('Workspace deleted', 'Close', { duration: 3000 });
          this.loadWorkspaces();
        },
        error: () => {
          this.snackBar.open('Failed to delete workspace', 'Close', { duration: 3000 });
        }
      });
    }
  }

  loadWorkspaces(): void {
    this.workspaceService.getWorkspaces().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(
      data => this.workspaces.set(data)
    );
  }
}
