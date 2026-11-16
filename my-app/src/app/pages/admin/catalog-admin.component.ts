import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

type CatalogTab = 'destinations' | 'tours' | 'review' | 'media';

@Component({
  selector: 'app-catalog-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './catalog-admin.component.html',
  styleUrl: './catalog-admin.component.css'
})
export class CatalogAdminComponent implements OnInit {
  tab: CatalogTab = 'destinations';
  loading = false;
  saving = false;
  error = '';
  notice = '';
  destinations: any[] = [];
  regions: any[] = [];
  provinces: any[] = [];
  tours: any[] = [];
  mediaQueue: any[] = [];
  total = 0;
  page = 1;
  pageSize = 20;
  search = '';
  selectedFiles: File[] = [];
  mediaTarget: 'destination' | 'tour' = 'destination';
  uploadProgress = '';
  rights = { sourceType: 'partner_upload', sourceUrl: '', photographer: '', licenseId: '', attributionText: '', rightsEvidence: '' };
  destinationForm = this.emptyDestination();
  tourForm = this.emptyTour();

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    void this.loadReferenceData();
    void this.loadDestinations();
    void this.loadReviewQueue();
  }

  private emptyDestination() {
    return { id: '', name: '', slug: '', aliasesText: '', regionId: '', adminAreaIds: [] as string[], description: '',
      latitude: '', longitude: '', coordinateVerification: 'pending', sourceName: '', sourceType: 'editorial', sourceUrl: '',
      status: 'editorial', mediaAssetIds: [] as string[], coverMediaAssetId: '' };
  }

  private emptyTour() {
    return { id: '', title: '', destinationIds: [] as string[], days: 1, description: '', style: '', status: 'demo',
      mediaAssetIds: [] as string[], coverMediaAssetId: '' };
  }

  async loadReferenceData(): Promise<void> {
    [this.regions, this.provinces] = await Promise.all([
      this.api.getNationalRegions(),
      this.api.getNationalProvinces({ page: 1, pageSize: 100 }).then(result => result?.items || [])
    ]);
    if (!this.destinationForm.regionId && this.regions.length) this.destinationForm.regionId = this.regions[0].id;
  }

  async loadDestinations(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.getAdminCatalogDestinations({ q: this.search, page: this.page, pageSize: this.pageSize });
      this.destinations = result?.items || [];
      this.total = Number(result?.total) || 0;
    } catch { this.error = 'Không tải được danh mục. Hãy kiểm tra quyền admin và kết nối backend.'; }
    finally { this.loading = false; }
  }

  async loadReviewQueue(): Promise<void> {
    try {
      const result = await this.api.getAdminCatalogReviewQueue();
      this.tours = result?.tours || [];
      this.mediaQueue = result?.media || [];
    } catch { /* The page displays the destination request error if the API is unavailable. */ }
  }

  startDestination(): void {
    this.destinationForm = this.emptyDestination();
    if (this.regions.length) this.destinationForm.regionId = this.regions[0].id;
    this.error = this.notice = '';
  }

  editDestination(item: any): void {
    this.destinationForm = {
      id: item.id, name: item.name || '', slug: item.slug || '', aliasesText: (item.aliases || []).join(', '),
      regionId: item.regionId || '', adminAreaIds: [...(item.adminAreaIds || [])], description: item.description || '',
      latitude: item.coordinates?.lat ?? '', longitude: item.coordinates?.lng ?? '',
      coordinateVerification: item.coordinateVerification || 'pending', sourceName: item.source?.name || '',
      sourceType: item.source?.type || 'editorial', sourceUrl: item.source?.url || '', status: item.status || 'editorial',
      mediaAssetIds: [...(item.mediaAssetIds || [])], coverMediaAssetId: item.coverMediaAssetId || ''
    };
    this.error = this.notice = '';
  }

  async saveDestination(): Promise<void> {
    const form = this.destinationForm;
    if (!form.name.trim() || !form.regionId) { this.error = 'Nhập tên điểm đến và chọn vùng.'; return; }
    this.saving = true; this.error = ''; this.notice = '';
    const hasCoordinates = form.latitude !== '' && form.longitude !== '';
    const payload = {
      name: form.name.trim(), slug: form.slug.trim(), aliases: form.aliasesText.split(',').map(alias => alias.trim()).filter(Boolean),
      regionId: form.regionId, adminAreaIds: form.adminAreaIds, description: form.description,
      coordinates: hasCoordinates ? { lat: Number(form.latitude), lng: Number(form.longitude) } : null,
      coordinateVerification: form.coordinateVerification, source: { name: form.sourceName, type: form.sourceType, url: form.sourceUrl },
      status: form.status, mediaAssetIds: form.mediaAssetIds, coverMediaAssetId: form.coverMediaAssetId || null
    };
    try {
      await this.api.saveAdminDestination(payload, form.id || undefined);
      this.notice = 'Đã lưu điểm đến vào catalog.';
      await this.loadDestinations();
    } catch (error: any) { this.error = error?.error?.message || 'Không lưu được điểm đến.'; }
    finally { this.saving = false; }
  }

  startTour(): void { this.tourForm = this.emptyTour(); this.error = this.notice = ''; }

  editTour(item: any): void {
    this.tourForm = { id: item.id, title: item.tour_name || '', destinationIds: [...(item.destination_ids || [])],
      days: item.days || 1, description: item.tour_description || '', style: item.style || '',
      status: item.catalog_status || 'editorial', mediaAssetIds: [...(item.mediaAssetIds || [])],
      coverMediaAssetId: item.coverMediaAssetId || '' };
    this.error = this.notice = '';
  }

  async saveTour(): Promise<void> {
    this.saving = true; this.error = ''; this.notice = '';
    try {
      await this.api.saveAdminEditorialTour({ title: this.tourForm.title, destinationIds: this.tourForm.destinationIds,
        days: Number(this.tourForm.days), description: this.tourForm.description, style: this.tourForm.style,
        status: this.tourForm.status, mediaAssetIds: this.tourForm.mediaAssetIds,
        coverMediaAssetId: this.tourForm.coverMediaAssetId || null }, this.tourForm.id || undefined);
      this.notice = 'Đã lưu nội dung tour biên tập.';
      await this.loadReviewQueue();
    } catch (error: any) { this.error = error?.error?.message || 'Không lưu được tour.'; }
    finally { this.saving = false; }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const gallery = this.mediaTarget === 'destination' ? this.destinationForm.mediaAssetIds : this.tourForm.mediaAssetIds;
    if (files.length + gallery.length > 15) {
      this.error = 'Mỗi gallery tối đa 15 ảnh.'; input.value = ''; return;
    }
    this.selectedFiles = files;
    this.error = '';
  }

  private readAsDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Không đọc được ảnh.'));
      reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
      reader.readAsDataURL(file);
    });
  }

  async uploadSelectedMedia(): Promise<void> {
    if (!this.selectedFiles.length) return;
    if (!this.rights.rightsEvidence.trim() || (this.rights.sourceType !== 'partner_upload' && !this.rights.licenseId.trim())) {
      this.error = 'Cần khai báo bằng chứng quyền sử dụng; ảnh stock phải có mã license.'; return;
    }
    this.saving = true; this.error = ''; this.uploadProgress = '';
    try {
      for (let i = 0; i < this.selectedFiles.length; i++) {
        this.uploadProgress = `Đang gửi ảnh ${i + 1}/${this.selectedFiles.length}…`;
        const dataUri = await this.readAsDataUri(this.selectedFiles[i]);
        const result = await this.api.uploadCatalogMedia({ dataUri, ...this.rights });
        const id = result?.item?.id;
        if (!result?.success || !id) throw new Error(result?.message || 'Backend không nhận ảnh.');
        const target = this.mediaTarget === 'destination' ? this.destinationForm : this.tourForm;
        target.mediaAssetIds = [...target.mediaAssetIds, id];
        if (!target.coverMediaAssetId) target.coverMediaAssetId = id;
      }
      this.notice = 'Ảnh đã tải lên và đang chờ kiểm duyệt quyền sử dụng.';
      this.selectedFiles = [];
      await this.loadReviewQueue();
    } catch (error: any) {
      this.error = error?.error?.message || error?.message || 'Không tải được ảnh. Kiểm tra cấu hình upload của backend.';
    } finally { this.saving = false; this.uploadProgress = ''; }
  }

  async verifyMedia(asset: any): Promise<void> {
    this.error = '';
    try { await this.api.verifyCatalogMedia(asset.id); this.notice = 'Đã xác minh quyền sử dụng ảnh.'; await this.loadReviewQueue(); }
    catch (error: any) { this.error = error?.error?.message || 'Ảnh cần hồ sơ quyền sử dụng hợp lệ trước khi xác minh.'; }
  }

  removeGalleryItem(form: any, id: string): void {
    form.mediaAssetIds = form.mediaAssetIds.filter((value: string) => value !== id);
    if (form.coverMediaAssetId === id) form.coverMediaAssetId = form.mediaAssetIds[0] || '';
  }

  moveGalleryItem(form: any, index: number, offset: -1 | 1): void {
    const next = index + offset;
    if (next < 0 || next >= form.mediaAssetIds.length) return;
    const ids = [...form.mediaAssetIds];
    [ids[index], ids[next]] = [ids[next], ids[index]];
    form.mediaAssetIds = ids;
  }

  setCover(form: any, id: string): void { if (form.mediaAssetIds.includes(id)) form.coverMediaAssetId = id; }
}
