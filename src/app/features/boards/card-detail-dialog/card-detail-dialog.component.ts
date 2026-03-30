import { Component, Inject, OnInit, OnDestroy, signal, ViewChild, ElementRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
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
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BoardService } from '../../../core/services/board.service';
import { VoiceRecordingService } from '../../../core/services/voice-recording.service';
import { CommentService } from '../../../core/services/comment.service';
import { ChecklistService } from '../../../core/services/checklist.service';
import { AttachmentService } from '../../../core/services/attachment.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { CustomAudioPlayerComponent } from '../../../shared/components/custom-audio-player/custom-audio-player.component';
import { ActivityLogService, ActivityLog } from '../services/activity-log.service';
import { Card, Comment, CardLabel, CardAssignee, WorkspaceMember, Checklist, ChecklistItem, Attachment, CardType } from '../../../core/models/board.model';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SignalRService } from '../../../core/services/signalr.service';

interface LabelOption {
  name: string;
  color: string;
}

@Component({
  selector: 'app-card-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatTooltipModule,
    MatTabsModule,
    MatMenuModule,
    MatCheckboxModule,
    MatProgressBarModule,
    CustomAudioPlayerComponent
  ],
  templateUrl: './card-detail-dialog.component.html',
  styleUrl: './card-detail-dialog.component.css'
})
export class CardDetailDialogComponent implements OnInit, OnDestroy {
  form: FormGroup;
  saving = signal(false);
  comments = signal<Comment[]>([]);
  workspaceMembers = signal<WorkspaceMember[]>([]);
  newComment = '';
  card: Card;
  uploadingVoice = signal(false);
  activityLogs = signal<ActivityLog[]>([]);

  // Typing Indicator
  typingUsers = signal<string[]>([]);
  typingTimeoutIds = new Map<string, any>();
  typingSubscription?: Subscription;

  typingIndicatorText = computed(() => {
    const users = this.typingUsers();
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return 'Several people are typing...';
  });

  // Labels
  newLabelName = '';
  newLabelColor = '#6366f1';
  availableLabels: LabelOption[] = [
    { name: 'Bug', color: '#ef4444' },
    { name: 'Feature', color: '#22c55e' },
    { name: 'Enhancement', color: '#3b82f6' },
    { name: 'Urgent', color: '#f97316' },
    { name: 'Documentation', color: '#8b5cf6' },
    { name: 'Testing', color: '#14b8a6' },
    { name: 'Design', color: '#ec4899' },
    { name: 'Backend', color: '#64748b' }
  ];

  isLocked = false;
  isLockedByMe = false;

  constructor(
    public dialogRef: MatDialogRef<CardDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { card: Card; boardId: string; workspaceId: string },
    private fb: FormBuilder,
    private boardService: BoardService,
    private commentService: CommentService,
    private checklistService: ChecklistService,
    private attachmentService: AttachmentService,
    private workspaceService: WorkspaceService,
    public voiceService: VoiceRecordingService,
    private activityLogService: ActivityLogService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private signalRService: SignalRService
  ) {
    this.card = data.card;
    this.isLocked = !!this.card.lockedByUserId;

    this.form = this.fb.group({
      title: [this.card.title, [Validators.required]],
      description: [this.card.description || ''],
      type: [this.card.type || CardType.Task],
      priority: [this.card.priority],
      dueDate: [this.card.dueDate],
      storyPoints: [this.card.storyPoints || null],
      estimatedHours: [this.card.estimatedHours || null]
    });
  }

  ngOnInit(): void {
    this.loadComments();
    this.loadWorkspaceMembers();
    this.lockCard();
    this.loadActivityLogs();

    this.typingSubscription = this.signalRService.userTyping$.subscribe(event => {
      // GUIDs must be lowercased to avoid strict equality matching issues
      if (
        event.cardId.toLowerCase() === this.card.id.toLowerCase() && 
        event.userId.toLowerCase() !== this.authService.currentUserValue?.id?.toLowerCase()
      ) {
        this.handleUserTyping(event.userId, event.userName);
      }
    });
  }

  handleUserTyping(userId: string, userName: string): void {
    const currentUsers = this.typingUsers();
    if (!currentUsers.includes(userName)) {
      this.typingUsers.set([...currentUsers, userName]);
    }

    if (this.typingTimeoutIds.has(userId)) {
      clearTimeout(this.typingTimeoutIds.get(userId));
    }

    const timeout = setTimeout(() => {
      this.typingUsers.update(users => users.filter(u => u !== userName));
      this.typingTimeoutIds.delete(userId);
    }, 3000);

    this.typingTimeoutIds.set(userId, timeout);
  }

  private lastTypingEmitTime = 0;

  onCommentInput(): void {
    const now = Date.now();
    // Throttle to 1 emit every 2 seconds
    if (now - this.lastTypingEmitTime > 2000) {
      this.signalRService.emitTyping(this.data.boardId, this.card.id);
      this.lastTypingEmitTime = now;
    }
  }

  loadActivityLogs() {
    this.activityLogService.getCardActivity(this.card.id).subscribe({
      next: (logs) => this.activityLogs.set(logs)
    });
  }

  ngOnDestroy(): void {
    this.voiceService.reset();
    this.typingSubscription?.unsubscribe();
    this.typingTimeoutIds.forEach(id => clearTimeout(id));

    // Release the concurrency lock on the card so others can edit it
    if (this.isLockedByMe) {
      this.boardService.unlockCard(this.card.id).subscribe({
        error: (err) => console.error('Failed to release card lock on close:', err)
      });
    }
  }

  availableMembers() {
    const assignedIds = new Set(this.card.assignees.map(a => a.userId));
    return this.workspaceMembers().filter(m => !assignedIds.has(m.userId));
  }

  loadComments(): void {
    this.commentService.getCardComments(this.card.id)
      .subscribe(comments => this.comments.set(comments));
  }

  loadWorkspaceMembers(): void {
    if (this.data.workspaceId) {
      this.workspaceService.getMembers(this.data.workspaceId)
        .subscribe(members => this.workspaceMembers.set(members));
    }
  }

  lockCard(): void {
    this.boardService.lockCard(this.card.id).subscribe({
      next: () => {
        this.isLockedByMe = true;
      },
      error: () => {
        // Card is locked by someone else
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.boardService.updateCard(this.card.id, this.form.value).subscribe({
      next: () => {
        this.snackBar.open('Card updated!', 'Close', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.saving.set(false);
        this.snackBar.open(error.message || 'Failed to update card', 'Close', { duration: 5000 });
      }
    });
  }

  // Labels
  addLabel(label: LabelOption): void {
    this.boardService.addLabel(this.card.id, label.name, label.color)
      .subscribe({
        next: (newLabel) => {
          this.card.labels.push({ id: newLabel.id, name: newLabel.name, color: newLabel.color });
          this.snackBar.open('Label added!', 'Close', { duration: 2000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Failed to add label', 'Close', { duration: 3000 });
        }
      });
  }

  addCustomLabel(): void {
    if (!this.newLabelName) return;
    this.addLabel({ name: this.newLabelName, color: this.newLabelColor });
    this.newLabelName = '';
  }

  removeLabel(label: CardLabel): void {
    this.boardService.removeLabel(this.card.id, label.id)
      .subscribe({
        next: () => {
          this.card.labels = this.card.labels.filter(l => l.id !== label.id);
          this.snackBar.open('Label removed!', 'Close', { duration: 2000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Failed to remove label', 'Close', { duration: 3000 });
        }
      });
  }

  // Assignees
  addAssignee(member: WorkspaceMember): void {
    this.boardService.addAssignee(this.card.id, member.userId)
      .subscribe({
        next: () => {
          this.card.assignees.push({
            userId: member.userId,
            firstName: member.firstName,
            lastName: member.lastName,
            avatarUrl: member.avatarUrl
          });
          this.snackBar.open('Assignee added!', 'Close', { duration: 2000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Failed to add assignee', 'Close', { duration: 3000 });
        }
      });
  }

  removeAssignee(assignee: CardAssignee): void {
    this.boardService.removeAssignee(this.card.id, assignee.userId)
      .subscribe({
        next: () => {
          this.card.assignees = this.card.assignees.filter(a => a.userId !== assignee.userId);
          this.snackBar.open('Assignee removed!', 'Close', { duration: 2000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Failed to remove assignee', 'Close', { duration: 3000 });
        }
      });
  }

  // Voice Recording
  async startRecording(): Promise<void> {
    const success = await this.voiceService.startRecording();
    if (!success) {
      this.snackBar.open('Could not access microphone. Please allow microphone access.', 'Close', { duration: 5000 });
    }
  }

  sendVoiceNote(): void {
    const audioBlob = this.voiceService.state().audioBlob;
    const duration = this.voiceService.state().duration;
    if (!audioBlob) return;

    this.uploadingVoice.set(true);

    this.commentService.addVoiceComment(this.card.id, audioBlob, duration)
      .subscribe({
        next: (comment) => {
          this.comments.update(c => [...c, comment]);
          this.voiceService.reset();
          this.uploadingVoice.set(false);
          this.snackBar.open('Voice note sent!', 'Close', { duration: 3000 });
        },
        error: () => {
          this.uploadingVoice.set(false);
          this.snackBar.open('Failed to upload voice note', 'Close', { duration: 5000 });
        }
      });
  }

  addComment(): void {
    if (!this.newComment.trim()) return;

    this.commentService.addTextComment(this.card.id, this.newComment)
      .subscribe({
        next: (comment) => {
          this.comments.update(c => [...c, comment]);
          this.newComment = '';
        },
        error: () => {
          this.snackBar.open('Failed to add comment', 'Close', { duration: 3000 });
        }
      });
  }

  deleteComment(commentId: string): void {
     if (!confirm('Delete this comment?')) return;
     this.commentService.deleteComment(commentId).subscribe({
        next: () => {
           this.comments.update(comments => comments.filter(c => c.id !== commentId));
           this.snackBar.open('Comment deleted', 'Close', { duration: 2000 });
        },
        error: () => this.snackBar.open('Failed to delete comment', 'Close', { duration: 3000 })
     });
  }

  // Checklists
  addChecklist(): void {
    const title = prompt('Checklist Title:');
    if (!title) return;

    this.checklistService.createChecklist(this.card.id, title).subscribe({
      next: (checklist: Checklist) => {
        if (!this.card.checklists) this.card.checklists = [];
        this.card.checklists.push(checklist);
        this.snackBar.open('Checklist created!', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to create checklist', 'Close', { duration: 3000 })
    });
  }

  deleteChecklist(checklistId: string): void {
    if (!confirm('Area you sure you want to delete this checklist?')) return;

    this.checklistService.deleteChecklist(checklistId).subscribe({
      next: () => {
        this.card.checklists = this.card.checklists.filter(cl => cl.id !== checklistId);
        this.snackBar.open('Checklist deleted', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to delete checklist', 'Close', { duration: 3000 })
    });
  }

  addItem(checklistId: string, input: HTMLInputElement): void {
    const content = input.value.trim();
    if (!content) return;

    this.checklistService.addItem(checklistId, content).subscribe({
      next: (item: ChecklistItem) => {
        const checklist = this.card.checklists.find(cl => cl.id === checklistId);
        if (checklist) {
          if (!checklist.items) checklist.items = [];
          checklist.items.push(item);
        }
        input.value = '';
      },
      error: () => this.snackBar.open('Failed to add item', 'Close', { duration: 3000 })
    });
  }

  toggleItem(checklistId: string, item: ChecklistItem): void {
      const originalState = item.isChecked;
      const newState = !originalState;

      // Optimistic Update
      item.isChecked = newState;

      this.checklistService.updateItem(item.id, item.content, newState).subscribe({
          next: () => {
              // Success, state already updated
          },
          error: () => {
             // Revert on error
             item.isChecked = originalState;
             this.snackBar.open('Failed to update item', 'Close', { duration: 3000 });
          }
      });
  }

  deleteItem(checklistId: string, itemId: string): void {
    this.checklistService.deleteItem(itemId).subscribe({
      next: () => {
        const checklist = this.card.checklists.find(cl => cl.id === checklistId);
        if (checklist) {
          checklist.items = checklist.items.filter(i => i.id !== itemId);
        }
      },
      error: () => this.snackBar.open('Failed to delete item', 'Close', { duration: 3000 })
    });
  }


  calculateProgress(checklist: Checklist): number {
    if (!checklist.items || checklist.items.length === 0) return 0;
    const completed = checklist.items.filter(i => i.isChecked).length;
    return Math.round((completed / checklist.items.length) * 100);
  }

  // Attachments
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  triggerFileUpload(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.attachmentService.uploadAttachment(this.card.id, file).subscribe({
        next: (attachment) => {
            if (!this.card.attachments) this.card.attachments = [];
            this.card.attachments.push(attachment);
            this.snackBar.open('Attachment uploaded', 'Close', { duration: 2000 });
        },
        error: () => this.snackBar.open('Failed to upload attachment', 'Close', { duration: 3000 })
    });
  }

  deleteAttachment(attachmentId: string): void {
      if (!confirm('Delete this attachment?')) return;

      this.attachmentService.deleteAttachment(attachmentId).subscribe({
          next: () => {
              this.card.attachments = this.card.attachments.filter(a => a.id !== attachmentId);
              this.snackBar.open('Attachment deleted', 'Close', { duration: 2000 });
          },
          error: () => this.snackBar.open('Failed to delete attachment', 'Close', { duration: 3000 })
      });
  }

  isImage(attachment: Attachment): boolean {
      return attachment.fileType.startsWith('image/');
  }

  getFileExtension(fileName: string): string {
      return fileName.split('.').pop()?.toUpperCase() || 'FILE';
  }

  formatFileSize(bytes: number): string {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  getTypeIcon(type: string): string {
    switch (type) {
      case 'Story': return 'auto_stories';
      case 'Bug': return 'bug_report';
      case 'Epic': return 'bolt';
      default: return 'check_box_outline_blank';
    }
  }

  getTimeProgress(): number {
    if (!this.card.estimatedHours || this.card.estimatedHours <= 0) return 0;
    return Math.min(100, Math.round((this.card.loggedHours / this.card.estimatedHours) * 100));
  }

  deleteCard(): void {
    if (confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
      this.boardService.deleteCard(this.card.id).subscribe({
        next: () => {
          this.snackBar.open('Card deleted', 'Close', { duration: 2000 });
          this.dialogRef.close({ deleted: true, cardId: this.card.id });
        },
        error: () => this.snackBar.open('Failed to delete card', 'Close', { duration: 3000 })
      });
    }
  }
}
