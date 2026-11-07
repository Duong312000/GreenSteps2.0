import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-network-error',
  standalone: false,
  templateUrl: './network-error.html',
  styleUrl: './network-error.css'
})
export class NetworkErrorComponent implements OnInit {
  public isChecking = false;
  public checkResult: 'idle' | 'success' | 'failed' = 'idle';

  constructor(
    private router: Router, 
    private http: HttpClient,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {}

  public retryConnection(): void {
    this.isChecking = true;
    this.checkResult = 'idle';

    const testUrl = `${this.apiService.BACKEND_URL}/faqs`;
    this.http.get(testUrl).subscribe({
      next: () => {
        this.isChecking = false;
        this.checkResult = 'success';
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 1000);
      },
      error: () => {
        this.isChecking = false;
        this.checkResult = 'failed';
      }
    });
  }

  public goHome(): void {
    this.router.navigate(['/home']);
  }
}
