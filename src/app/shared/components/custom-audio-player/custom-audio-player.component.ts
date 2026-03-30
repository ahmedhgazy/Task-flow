import { Component, Input, ViewChild, ElementRef, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-custom-audio-player',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './custom-audio-player.component.html',
  styleUrl: './custom-audio-player.component.css'
})
export class CustomAudioPlayerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) src!: string;
  @ViewChild('audioElement') audioRef!: ElementRef<HTMLAudioElement>;

  isPlaying = signal(false);
  currentTime = signal(0);
  duration = signal(0);

  formattedCurrentTime = computed(() => this.formatTime(this.currentTime()));
  formattedDuration = computed(() => this.formatTime(this.duration()));
  
  // Progress percentage (0 to 100)
  progressPercentage = computed(() => {
    const dur = this.duration();
    if (dur === 0) return 0;
    return (this.currentTime() / dur) * 100;
  });

  private timeUpdateListener!: () => void;
  private loadedMetadataListener!: () => void;
  private endedListener!: () => void;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    const audio = this.audioRef.nativeElement;

    this.timeUpdateListener = () => {
      this.currentTime.set(audio.currentTime);
    };

    this.loadedMetadataListener = () => {
      this.duration.set(audio.duration);
    };

    this.endedListener = () => {
      this.isPlaying.set(false);
      this.currentTime.set(0);
      audio.currentTime = 0;
    };

    audio.addEventListener('timeupdate', this.timeUpdateListener);
    audio.addEventListener('loadedmetadata', this.loadedMetadataListener);
    audio.addEventListener('ended', this.endedListener);
  }

  ngOnDestroy(): void {
    if (this.audioRef?.nativeElement) {
      const audio = this.audioRef.nativeElement;
      audio.removeEventListener('timeupdate', this.timeUpdateListener);
      audio.removeEventListener('loadedmetadata', this.loadedMetadataListener);
      audio.removeEventListener('ended', this.endedListener);
    }
  }

  togglePlay(): void {
    const audio = this.audioRef.nativeElement;
    if (this.isPlaying()) {
      audio.pause();
      this.isPlaying.set(false);
    } else {
      audio.play();
      this.isPlaying.set(true);
    }
  }

  seekTo(event: MouseEvent | TouchEvent): void {
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    let clientX = 0;
    
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event instanceof TouchEvent) {
      clientX = event.touches[0].clientX;
    }

    const clickPosition = clientX - rect.left;
    const clickPercentage = clickPosition / rect.width;
    const audio = this.audioRef.nativeElement;
    
    const newTime = clickPercentage * this.duration();
    audio.currentTime = newTime;
    this.currentTime.set(newTime);
  }

  private formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  }
}
