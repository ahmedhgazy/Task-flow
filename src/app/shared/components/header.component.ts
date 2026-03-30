import { Component, Input, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { SearchService, SearchResultItem } from '../../core/services/search.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil, filter } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() backLink: string[] | null = null;

  searchControl = new FormControl('');
  results: SearchResultItem[] = [];
  showResults = false;
  isSearching = false;
  private destroy$ = new Subject<void>();

  constructor(
    public authService: AuthService,
    private searchService: SearchService,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      filter(term => {
        if (!term || term.length < 2) {
          this.results = [];
          return false;
        }
        return true;
      }),
      switchMap(term => {
        this.isSearching = true;
        return this.searchService.search(term!);
      })
    ).subscribe({
      next: (response) => {
        this.results = response.items;
        this.isSearching = false;
        this.showResults = true;
      },
      error: () => {
        this.isSearching = false;
        this.results = [];
      }
    });

    this.router.events.pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.showResults = false;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showResults = false;
    }
  }

  navigateTo(item: SearchResultItem) {
    this.router.navigateByUrl(item.url);
    this.showResults = false;
  }

  getUserInitials(): string {
    const user = this.authService.currentUserValue;
    if (!user) return '?';
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || '?';
  }

  currentUser() {
    return this.authService.currentUserValue;
  }

  logout(): void {
    this.authService.logout();
  }
}
