import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'workspaces',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'invite/accept',
    loadComponent: () => import('./features/workspaces/accept-invite/accept-invite.component').then(m => m.AcceptInviteComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    loadComponent: () => import('./core/components/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'workspaces',
        loadComponent: () => import('./features/workspaces/workspaces-list/workspaces-list.component').then(m => m.WorkspacesListComponent)
      },
      {
        path: 'workspaces/:id',
        loadComponent: () => import('./features/workspaces/workspace-detail/workspace-detail.component').then(m => m.WorkspaceDetailComponent)
      },
      {
        path: 'boards',
        loadComponent: () => import('./features/boards/boards-list/boards-list.component').then(m => m.BoardsListComponent)
      },
      {
        path: 'boards/:id',
        loadComponent: () => import('./features/boards/board-view/board-view.component').then(m => m.BoardViewComponent)
      },
      {
        path: 'calendar',
        loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent)
      },
      {
        path: 'invitations',
        loadComponent: () => import('./features/workspaces/invitations/invitations.component').then(m => m.InvitationsComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'workspaces'
  }
];
