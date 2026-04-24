import { Component, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './accept-invite.component.html',
  styleUrl: './accept-invite.component.css'
})
export class AcceptInviteComponent implements OnInit {
  loading = signal(true);
  error = signal(false);
  processing = signal(false);
  errorMessage = '';
  token: string | null = null;
  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workspaceService: WorkspaceService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.token = params['token'];
      this.loading.set(false);

      if (!this.token) {
        this.error.set(true);
        this.errorMessage = 'Invalid invitation link';
      }
    });
  }

  acceptInvitation(): void {
    if (!this.token) return;

    this.processing.set(true);
    this.workspaceService.acceptInvitation(this.token).subscribe({
      next: () => {
        this.snackBar.open('Welcome to the workspace!', 'Close', { duration: 3000 });
        this.router.navigate(['/workspaces']); 
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(true);
        this.errorMessage = err.error?.message || 'Failed to accept invitation';
      }
    });
  }
}
