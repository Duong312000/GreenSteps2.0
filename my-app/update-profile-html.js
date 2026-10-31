const fs = require('fs');
let code = fs.readFileSync('c:/Users/Admin/.antigravity-ide/GreenSteps2.0/my-app/src/app/pages/profile/profile.html', 'utf8');

// 1. Update upcoming-trip-card header and action button
code = code.replace(
  '<a routerLink="/schedule">Xem tất cả <i class="bi bi-arrow-right"></i></a>\r\n                    </header>',
  '<a href="#" (click)="activeSection = \'tickets\'; $event.preventDefault()">Xem tất cả <i class="bi bi-arrow-right"></i></a>\r\n                    </header>'
);

code = code.replace(
  '<button type="button" [routerLink]="upcomingTrip.link">Xem chi tiết</button>',
  '<button type="button" (click)="openTripDetails(upcomingTrip)">Xem chi tiết</button>'
);

code = code.replace(
  '<a href="#" (click)="scrollToUpcomingTrip($event)">Xem chi tiết <i\r\n                                        class="bi bi-arrow-right"></i></a>',
  '<a href="#" (click)="activeSection = \'tickets\'; $event.preventDefault()">Xem chi tiết <i\r\n                                        class="bi bi-arrow-right"></i></a>'
);

// 2. Update tickets section
const oldTicketsSection = \`        <div *ngIf="upcomingTrip; else noTickets" style="display: flex; flex-direction: column; gap: 20px;">
            <article class="profile-card dashboard-card" style="border-radius: 20px; padding: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #d1d5db; padding-bottom: 18px; margin-bottom: 20px;">
                    <div>
                        <span style="background: #e8f5ee; color: #0f6b45; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px;">{{ upcomingTrip.statusText }}</span>
                        <h3 style="font-size: 20px; font-weight: 800; color: #1e293b; margin: 10px 0 4px;">{{ upcomingTrip.title }}</h3>
                        <p style="color: #64748b; font-size: 13px; margin: 0;"><i class="bi bi-geo-alt"></i> {{ upcomingTrip.destination }}</p>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 12px; color: #94a3b8; display: block;">Mã vé điện tử</span>
                        <strong style="font-size: 18px; font-family: monospace; color: #0f6b45; letter-spacing: 2px;">GS-{{ (upcomingTrip.id || '24411').substring(0, 6) | uppercase }}</strong>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div style="background: #f8fafc; padding: 14px; border-radius: 12px;">
                        <span style="font-size: 11px; color: #64748b; display: block; font-weight: 700;">NGÀY KHỞI HÀNH</span>
                        <strong style="font-size: 14px; color: #1e293b; margin-top: 4px; display: block;">{{ upcomingTrip.dates }}</strong>
                    </div>
                    <div style="background: #f8fafc; padding: 14px; border-radius: 12px;">
                        <span style="font-size: 11px; color: #64748b; display: block; font-weight: 700;">SỐ LƯỢNG KHÁCH</span>
                        <strong style="font-size: 14px; color: #1e293b; margin-top: 4px; display: block;">{{ upcomingTrip.guests }} người</strong>
                    </div>
                    <div style="background: #f8fafc; padding: 14px; border-radius: 12px;">
                        <span style="font-size: 11px; color: #64748b; display: block; font-weight: 700;">TỔNG THANH TOÁN</span>
                        <strong style="font-size: 14px; color: #0f6b45; margin-top: 4px; display: block;">{{ upcomingTrip.cost | number:'1.0-0' }}đ</strong>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" [routerLink]="upcomingTrip.link" style="padding: 10px 20px; border-radius: 10px; background: #0f6b45; color: white; border: none; font-weight: 700; font-size: 13px; cursor: pointer;">
                        <i class="bi bi-ticket-detailed"></i> Chi tiết hành trình
                    </button>
                </div>
            </article>
        </div>\`;

const newTicketsSection = \`        <div *ngIf="userTickets.length > 0; else (upcomingTrip ? singleTicket : noTickets)" style="display: flex; flex-direction: column; gap: 20px;">
            <article class="profile-card dashboard-card" style="border-radius: 20px; padding: 24px;" *ngFor="let ticket of userTickets">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #d1d5db; padding-bottom: 18px; margin-bottom: 20px;">
                    <div>
                        <span style="background: #e8f5ee; color: #0f6b45; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px;">{{ ticket.statusText }}</span>
                        <h3 style="font-size: 20px; font-weight: 800; color: #1e293b; margin: 10px 0 4px;">{{ ticket.title }}</h3>
                        <p style="color: #64748b; font-size: 13px; margin: 0;"><i class="bi bi-geo-alt"></i> {{ ticket.destination }}</p>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 12px; color: #94a3b8; display: block;">Mã vé điện tử</span>
                        <strong style="font-size: 18px; font-family: monospace; color: #0f6b45; letter-spacing: 2px;">{{ ticket.evoucher }}</strong>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div style="background: #f8fafc; padding: 14px; border-radius: 12px;">
                        <span style="font-size: 11px; color: #64748b; display: block; font-weight: 700;">NGÀY KHỞI HÀNH</span>
                        <strong style="font-size: 14px; color: #1e293b; margin-top: 4px; display: block;">{{ ticket.dates }}</strong>
                    </div>
                    <div style="background: #f8fafc; padding: 14px; border-radius: 12px;">
                        <span style="font-size: 11px; color: #64748b; display: block; font-weight: 700;">SỐ LƯỢNG KHÁCH</span>
                        <strong style="font-size: 14px; color: #1e293b; margin-top: 4px; display: block;">{{ ticket.guests }} người</strong>
                    </div>
                    <div style="background: #f8fafc; padding: 14px; border-radius: 12px;">
                        <span style="font-size: 11px; color: #64748b; display: block; font-weight: 700;">TỔNG THANH TOÁN</span>
                        <strong style="font-size: 14px; color: #0f6b45; margin-top: 4px; display: block;">{{ ticket.cost | number:'1.0-0' }}đ</strong>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <a routerLink="/tours" style="padding: 10px 20px; border-radius: 10px; background: #0f6b45; color: white; border: none; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="bi bi-compass"></i> Khám phá thêm tour
                    </a>
                </div>
            </article>
        </div>

        <ng-template #singleTicket>
            <div *ngIf="upcomingTrip" style="display: flex; flex-direction: column; gap: 20px;">
                <article class="profile-card dashboard-card" style="border-radius: 20px; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #d1d5db; padding-bottom: 18px; margin-bottom: 20px;">
                        <div>
                            <span style="background: #e8f5ee; color: #0f6b45; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px;">{{ upcomingTrip.statusText }}</span>
                            <h3 style="font-size: 20px; font-weight: 800; color: #1e293b; margin: 10px 0 4px;">{{ upcomingTrip.title }}</h3>
                            <p style="color: #64748b; font-size: 13px; margin: 0;"><i class="bi bi-geo-alt"></i> {{ upcomingTrip.destination }}</p>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 12px; color: #94a3b8; display: block;">Mã vé điện tử</span>
                            <strong style="font-size: 18px; font-family: monospace; color: #0f6b45; letter-spacing: 2px;">GS-{{ (upcomingTrip.id || '24411').substring(0, 6) | uppercase }}</strong>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px;">
                        <div style="background: #f8fafc; padding: 14px; border-radius: 12px;">
                            <span style="font-size: 11px; color: #64748b; display: block; font-weight: 700;">NGÀY KHỞI HÀNH</span>
                            <strong style="font-size: 14px; color: #1e293b; margin-top: 4px; display: block;">{{ upcomingTrip.dates }}</strong>
                        </div>
                        <div style="background: #f8fafc; padding: 14px; border-radius: 12px;">
                            <span style="font-size: 11px; color: #64748b; display: block; font-weight: 700;">SỐ LƯỢNG KHÁCH</span>
                            <strong style="font-size: 14px; color: #1e293b; margin-top: 4px; display: block;">{{ upcomingTrip.guests }} người</strong>
                        </div>
                        <div style="background: #f8fafc; padding: 14px; border-radius: 12px;">
                            <span style="font-size: 11px; color: #64748b; display: block; font-weight: 700;">TỔNG THANH TOÁN</span>
                            <strong style="font-size: 14px; color: #0f6b45; margin-top: 4px; display: block;">{{ upcomingTrip.cost | number:'1.0-0' }}đ</strong>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <a routerLink="/tours" style="padding: 10px 20px; border-radius: 10px; background: #0f6b45; color: white; border: none; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="bi bi-compass"></i> Khám phá thêm tour
                        </a>
                    </div>
                </article>
            </div>
        </ng-template>\`;

const normOld = oldTicketsSection.replace(/\\r\\n/g, '\\n');
const normCode = code.replace(/\\r\\n/g, '\\n');

if (normCode.includes(normOld)) {
  const updated = normCode.replace(normOld, newTicketsSection.replace(/\\r\\n/g, '\\n'));
  fs.writeFileSync('c:/Users/Admin/.antigravity-ide/GreenSteps2.0/my-app/src/app/pages/profile/profile.html', updated, 'utf8');
  console.log('SUCCESSFULLY UPDATED profile.html');
} else {
  console.log('OLD TICKETS SECTION NOT FOUND');
}

