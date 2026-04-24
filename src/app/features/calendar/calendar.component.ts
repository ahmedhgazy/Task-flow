import { Component, OnInit, signal, computed, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CardDetailDialogComponent } from '../boards/card-detail-dialog/card-detail-dialog.component';
import { BoardService } from '../../core/services/board.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface CalendarCard {
  id: string;
  title: string;
  dueDate: Date;
  priority: string;
  boardId: string;
  boardName: string;
  listName: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  cards: CalendarCard[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css'
})
export class CalendarComponent implements OnInit {
  loading = signal(true);
  allCards = signal<CalendarCard[]>([]);
  private destroyRef = inject(DestroyRef);

  currentDate = new Date();
  currentYear = signal(this.currentDate.getFullYear());
  currentMonth = signal(this.currentDate.getMonth());

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  get currentMonthName(): string {
    return new Date(this.currentYear(), this.currentMonth()).toLocaleString('default', { month: 'long' });
  }

  // O(1) Lookup Map for calendar card rendering
  cardsByDate = computed(() => {
    const map = new Map<string, CalendarCard[]>();
    for (const card of this.allCards()) {
      if (!card.dueDate) continue;
      const d = new Date(card.dueDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  });

  calendarDays = computed(() => {
    const days: CalendarDay[] = [];
    const year = this.currentYear();
    const month = this.currentMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const endPadding = 6 - lastDay.getDay();

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push(this.createCalendarDay(date, false));
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push(this.createCalendarDay(date, true));
    }

    // Next month padding
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(year, month + 1, i);
      days.push(this.createCalendarDay(date, false));
    }

    return days;
  });

  upcomingCards = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.allCards()
      .filter(c => new Date(c.dueDate) >= today)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  });

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private boardService: BoardService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadCards();
  }

  loadCards(): void {
    this.loading.set(true);
    this.http.get<CalendarCard[]>(`${environment.apiUrl}/boards/calendar/cards`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cards) => {
          this.allCards.set(cards);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
  }

  private createCalendarDay(date: Date, isCurrentMonth: boolean): CalendarDay {
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();

    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const cards = this.cardsByDate().get(dateKey) || [];

    return { date, isCurrentMonth, isToday, cards };
  }

  openCardDetail(calendarCard: CalendarCard): void {
    this.loading.set(true);
    this.boardService.getCard(calendarCard.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (fullCard) => {
        this.loading.set(false);
        const dialogRef = this.dialog.open(CardDetailDialogComponent, {
          width: '900px',
          maxWidth: '95vw',
          panelClass: ['dark-dialog', 'no-padding-dialog'],
          data: { 
            card: fullCard,
            boardId: calendarCard.boardId 
          }
        });

        dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
          if (result) {
            this.loadCards(); // Reload to reflect any potential updates
          }
        });
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load card details', 'Close', { duration: 3000 });
      }
    });
  }

  previousMonth(): void {
    if (this.currentMonth() === 0) {
      this.currentMonth.set(11);
      this.currentYear.update(y => y - 1);
    } else {
      this.currentMonth.update(m => m - 1);
    }
  }

  nextMonth(): void {
    if (this.currentMonth() === 11) {
      this.currentMonth.set(0);
      this.currentYear.update(y => y + 1);
    } else {
      this.currentMonth.update(m => m + 1);
    }
  }

  goToToday(): void {
    const today = new Date();
    this.currentYear.set(today.getFullYear());
    this.currentMonth.set(today.getMonth());
  }

  isOverdue(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d < new Date();
  }

  formatDueDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
