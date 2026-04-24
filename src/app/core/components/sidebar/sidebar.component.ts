import { Component, Input, Output, EventEmitter, signal, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../services/auth.service';
import { WorkspaceService } from '../../services/workspace.service';
import { ThemeService } from '../../services/theme.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  isCollapsed = signal<boolean>(false);
  pendingInvitationsCount = signal<number>(0);

  themeService = inject(ThemeService);
  private destroyRef = inject(DestroyRef);

  toggleCollapse(): void {
    this.isCollapsed.update(v => !v);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  constructor(
    public authService: AuthService,
    private workspaceService: WorkspaceService
  ) {}

  ngOnInit(): void {
    if (this.authService.currentUserValue) {
      this.workspaceService.getMyInvitations().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (invites) => {
          this.pendingInvitationsCount.set(invites.length);
        },
        error: () => {
          this.pendingInvitationsCount.set(0);
        }
      });
    }
  }

  getUserInitials(): string {
    const user = this.authService.currentUserValue;
    if (!user) return 'U';
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase();
  }

  logout(): void {
    this.authService.logout();
  }
}
