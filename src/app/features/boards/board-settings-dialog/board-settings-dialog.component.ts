import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BoardService } from '../../../core/services/board.service';
import { AutomationService } from '../../../core/services/automation.service';
import { Board, AutomationRule, AutomationTriggerType, AutomationActionType } from '../../../core/models/board.model';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-board-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatTabsModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './board-settings-dialog.component.html',
  styleUrl: './board-settings-dialog.component.css'
})
export class BoardSettingsDialogComponent implements OnInit {
  selectedColor: string = '';
  imageUrl: string = '';
  showCreateRule = false;
  creatingRule = signal(false);
  loadingRules = signal(false);
  rules = signal<AutomationRule[]>([]);

  newRule = {
    name: '',
    triggerType: '' as AutomationTriggerType | '',
    triggerValue: '',
    actionType: '' as AutomationActionType | '',
    actionValue: ''
  };

  colors = [
    '#1e293b', '#0f172a', '#172554', '#1e1b4b',
    '#312e81', '#4338ca', '#3730a3',
    '#4c1d95', '#581c87',
    '#831843', '#881337',
    '#14532d', '#064e3b', '#065f46',
    '#d97706', '#b45309' // added some warm colors
  ];

  gradients = [
    'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(to right, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(to right, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(to top, #30cfd0 0%, #330867 100%)',
    'linear-gradient(to right, #b8cbb8 0%, #b465da 0%, #cf6cc9 33%, #ee609c 66%, #ee609c 100%)'
  ];

  constructor(
    public dialogRef: MatDialogRef<BoardSettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { board: Board },
    private boardService: BoardService,
    private automationService: AutomationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.selectedColor = this.data.board.backgroundColor || this.colors[0];
    this.imageUrl = this.data.board.backgroundImageUrl || '';
    this.loadRules();
  }

  selectColor(color: string) {
    this.selectedColor = color;
    this.imageUrl = '';
  }

  updateImage() {
    if (this.imageUrl) {
      this.selectedColor = '';
    }
  }

  saveSettings() {
    const updates = {
      name: this.data.board.name,
      backgroundColor: this.selectedColor,
      backgroundImageUrl: this.imageUrl
    };

    this.boardService.updateBoard(this.data.board.id, updates).subscribe({
      next: (updatedBoard) => {
        this.dialogRef.close(updatedBoard);
        this.snackBar.open('Board settings updated', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to update board', err);
        this.snackBar.open('Failed to update settings', 'Close', { duration: 3000 });
      }
    });
  }

  loadRules(): void {
    this.loadingRules.set(true);
    this.automationService.getBoardRules(this.data.board.id).subscribe({
      next: (rules) => {
        this.rules.set(rules);
        this.loadingRules.set(false);
      },
      error: () => {
        this.loadingRules.set(false);
        this.snackBar.open('Failed to load automation rules', 'Close', { duration: 3000 });
      }
    });
  }

  createRule(): void {
    if (!this.newRule.triggerType || !this.newRule.actionType) return;

    this.creatingRule.set(true);
    this.automationService.createRule(this.data.board.id, {
      name: this.newRule.name || undefined,
      triggerType: this.newRule.triggerType as AutomationTriggerType,
      triggerValue: this.newRule.triggerValue || undefined,
      actionType: this.newRule.actionType as AutomationActionType,
      actionValue: this.newRule.actionValue || undefined
    }).subscribe({
      next: () => {
        this.creatingRule.set(false);
        this.showCreateRule = false;
        this.resetNewRule();
        this.loadRules();
        this.snackBar.open('Automation rule created!', 'Close', { duration: 2000 });
      },
      error: (err) => {
        this.creatingRule.set(false);
        this.snackBar.open(err.error?.message || 'Failed to create rule', 'Close', { duration: 3000 });
      }
    });
  }

  toggleRule(rule: AutomationRule): void {
    this.automationService.updateRule(rule.id, {
      name: rule.name,
      triggerType: rule.triggerType,
      triggerValue: rule.triggerValue,
      actionType: rule.actionType,
      actionValue: rule.actionValue,
      isEnabled: !rule.isEnabled
    }).subscribe({
      next: () => this.loadRules(),
      error: () => this.snackBar.open('Failed to update rule', 'Close', { duration: 3000 })
    });
  }

  deleteRule(ruleId: string): void {
    if (!confirm('Delete this automation rule?')) return;

    this.automationService.deleteRule(ruleId).subscribe({
      next: () => {
        this.rules.update(rules => rules.filter(r => r.id !== ruleId));
        this.snackBar.open('Rule deleted', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to delete rule', 'Close', { duration: 3000 })
    });
  }

  resetNewRule(): void {
    this.newRule = { name: '', triggerType: '', triggerValue: '', actionType: '', actionValue: '' };
  }

  formatTrigger(type: string): string {
    const map: Record<string, string> = {
      'CardMovedToList': 'Card moved',
      'CardCreated': 'Card created',
      'LabelAdded': 'Label added',
      'DueDatePassed': 'Due date passed',
      'CardAssigned': 'Card assigned'
    };
    return map[type] || type;
  }

  formatAction(type: string): string {
    const map: Record<string, string> = {
      'SetLabel': 'Set label',
      'RemoveAllAssignees': 'Remove assignees',
      'SetPriority': 'Set priority',
      'MoveToList': 'Move to list',
      'SendWebhook': 'Send webhook'
    };
    return map[type] || type;
  }
}
