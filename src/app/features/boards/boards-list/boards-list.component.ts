import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BoardService } from '../../../core/services/board.service';
import { Board } from '../../../core/models/board.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-boards-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './boards-list.component.html',
  styleUrl: './boards-list.component.css'
})
export class BoardsListComponent implements OnInit {
  boards = signal<Board[]>([]);
  loading = signal(true);

  constructor(
    private boardService: BoardService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.boardService.getBoards().subscribe({
      next: (data) => {
        this.boards.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
