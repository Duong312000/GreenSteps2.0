import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-footer',
  standalone: false,
  templateUrl: './footer.html',
})
export class FooterComponent {
  constructor(public authService: AuthService) {}
}

export { FooterComponent as Footer };
