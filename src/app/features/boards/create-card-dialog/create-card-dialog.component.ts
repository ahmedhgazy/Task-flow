import { Component, Inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { BoardService } from '../../../core/services/board.service';
import { CardPriority, CardType } from '../../../core/models/board.model';

@Component({
  selector: 'app-create-card-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule
  ],
  templateUrl: './create-card-dialog.component.html',
  styleUrl: './create-card-dialog.component.css'
})
export class CreateCardDialogComponent {
  form: FormGroup;
  loading = signal(false);

  constructor(
    public dialogRef: MatDialogRef<CreateCardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { listId: string },
    private fb: FormBuilder,
    private boardService: BoardService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(500)]],
      description: [''],
      type: [CardType.Task],
      priority: [CardPriority.Medium],
      dueDate: [null],
      storyPoints: [null],
      estimatedHours: [null]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    const formValue = this.form.value;

    // Clean up null/empty numeric values
    const payload = {
      ...formValue,
      storyPoints: formValue.storyPoints || undefined,
      estimatedHours: formValue.estimatedHours || undefined
    };

    this.boardService.createCard(this.data.listId, payload).subscribe({
      next: (card) => {
        this.loading.set(false);
        this.snackBar.open('Card added!', 'Close', { duration: 3000 });
        this.dialogRef.close(card);
      },
      error: (error) => {
        this.loading.set(false);
        this.snackBar.open(error.message || 'Failed to add card', 'Close', { duration: 5000 });
      }
    });
  }
}
