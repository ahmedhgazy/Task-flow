import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { WorkspaceService } from '../../../core/services/workspace.service';

@Component({
  selector: 'app-create-workspace-dialog',
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
  templateUrl: './create-workspace-dialog.component.html',
  styleUrl: './create-workspace-dialog.component.css'
})
export class CreateWorkspaceDialogComponent {
  form: FormGroup;
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<CreateWorkspaceDialogComponent>,
    private fb: FormBuilder,
    private workspaceService: WorkspaceService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.maxLength(1000)]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.workspaceService.createWorkspace(this.form.value).subscribe({
      next: (workspace) => {
        this.snackBar.open('Workspace created!', 'Close', { duration: 3000 });
        this.dialogRef.close(workspace);
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error.message || 'Failed to create workspace', 'Close', { duration: 5000 });
      }
    });
  }
}
