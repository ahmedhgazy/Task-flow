import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BoardService } from '../../../core/services/board.service';

@Component({
  selector: 'app-create-list-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './create-list-dialog.component.html',
  styleUrl: './create-list-dialog.component.css'
})
export class CreateListDialogComponent {
  form: FormGroup;
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<CreateListDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { boardId: string },
    private fb: FormBuilder,
    private boardService: BoardService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.boardService.createList(this.data.boardId, this.form.value).subscribe({
      next: (list) => {
        this.snackBar.open('List added!', 'Close', { duration: 3000 });
        this.dialogRef.close(list);
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error.message || 'Failed to add list', 'Close', { duration: 5000 });
      }
    });
  }
}
