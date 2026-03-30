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

const COLORS = [
  '#1e40af', '#7c3aed', '#c026d3', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#0284c7'
];

@Component({
  selector: 'app-create-board-dialog',
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
  templateUrl: './create-board-dialog.component.html',
  styleUrl: './create-board-dialog.component.css'
})
export class CreateBoardDialogComponent {
  form: FormGroup;
  loading = false;
  colors = COLORS;
  selectedColor = COLORS[0];

  constructor(
    public dialogRef: MatDialogRef<CreateBoardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { workspaceId: string },
    private fb: FormBuilder,
    private boardService: BoardService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.maxLength(2000)]
    });
  }

  selectColor(color: string): void {
    this.selectedColor = color;
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.boardService.createBoard(this.data.workspaceId, {
      ...this.form.value,
      backgroundColor: this.selectedColor
    }).subscribe({
      next: (board) => {
        this.snackBar.open('Board created!', 'Close', { duration: 3000 });
        this.dialogRef.close(board);
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error.message || 'Failed to create board', 'Close', { duration: 5000 });
      }
    });
  }
}
