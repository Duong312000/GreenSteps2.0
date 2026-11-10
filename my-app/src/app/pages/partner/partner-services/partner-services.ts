import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { LoginModalService } from '../../../services/login-modal.service';
import { User, Service, ServiceRoom, ServiceAmenity, ServiceAmenityGroup, ServiceGreenFeature, ServiceNearbyGroup, ServicePolicyGroup } from '../../../models/models';

@Component({
  selector: 'app-partner-services',
  standalone: false,
  templateUrl: './partner-services.html',
  styleUrls: ['./partner-services.css'],
})
export class PartnerServicesComponent implements OnInit {
  public currentUser: User | null = null;
  public myServices: Service[] = [];

  // Add / Edit Service Form (Wizard State)
  public isAddModalOpen: boolean = false;
  private autoAddOpened = false;
  public editingServiceId: string | null = null;
  public currentStep: number = 1;
  public readonly serviceFormSteps = [
    { id: 1, label: 'Tổng quan' },
    { id: 2, label: 'Phòng' },
    { id: 3, label: 'Tiện nghi & Dịch vụ' },
    { id: 4, label: 'Chính sách' },
    { id: 5, label: 'Vị trí' }
  ];

  // Form Fields
  public serviceName: string = '';
  public serviceType: string = 'stay';
  public serviceCost: number | null = null;
  public serviceCarbon: number | null = null;
  public serviceDest: string = 'Đà Lạt';
  public serviceAddress: string = '';
  public maxCapacity: number | null = null;
  public imageUrl: string = 'image/Viet Nam.png';
  public galleryImages: string[] = [];
  public openingSchedule: string = '';
  public cancellationPolicy: string = '';
  public itineraryText: string = '';
  public selectedBadges: string[] = ['green'];

  // Form Fields (screenshot upgrades)
  public childPrice: number | null = null;
  public serviceDuration: string = '';
  public serviceShortDesc: string = '';
  public slotsPerDay: number = 1;
  public startTime: string = '';
  public notesForCustomers: string = '';
  public roomDrafts: ServiceRoom[] = [];
  public readonly roomAmenityOptions = ['WiFi', 'TV', 'Minibar', 'Điều hòa', 'Bồn tắm', 'Vòi sen riêng', 'Ban công', 'Máy sấy tóc'];
  public amenityGroupDrafts: ServiceAmenityGroup[] = [];
  public popularAmenityDrafts: ServiceAmenity[] = [];
  public greenFeatureDrafts: ServiceGreenFeature[] = [];
  public policyGroupDrafts: ServicePolicyGroup[] = [];
  public areaDescription: string = '';
  public nearbyGroupDrafts: ServiceNearbyGroup[] = [];
  public locationLatitude: number | null = null;
  public locationLongitude: number | null = null;

  // Drag and Drop Image state
  public isDragging: boolean = false;

  // Custom Dialog Modal
  public customDialog: { 
    message: string; 
    type: 'success' | 'error' | 'info' | 'confirm'; 
    onConfirm?: () => void; 
    onCancel?: () => void;
  } | null = null;

  public showAlert(message: string, type: 'success' | 'error' | 'info' = 'success', callback?: () => void) {
    this.customDialog = {
      message,
      type,
      onConfirm: () => {
        this.closeCustomDialog();
        if (callback) callback();
      }
    };
    this.cdr.detectChanges();
  }

  public showConfirm(message: string, onConfirm: () => void, onCancel?: () => void) {
    this.customDialog = {
      message,
      type: 'confirm',
      onConfirm: () => {
        this.closeCustomDialog();
        onConfirm();
      },
      onCancel: () => {
        this.closeCustomDialog();
        if (onCancel) onCancel();
      }
    };
    this.cdr.detectChanges();
  }

  public closeCustomDialog() {
    this.customDialog = null;
    this.cdr.detectChanges();
  }

  // Community Sharing State
  public isShareModalOpen: boolean = false;
  public sharingService: Service | null = null;
  public shareMessage: string = '';

  public openShareModal(srv: Service) {
    this.sharingService = srv;
    this.shareMessage = `Khám phá dịch vụ "${srv.name}" tại ${srv.destination}.`;
    this.isShareModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeShareModal() {
    this.isShareModalOpen = false;
    this.sharingService = null;
    this.shareMessage = '';
    this.cdr.detectChanges();
  }

  public async submitShareToCommunity() {
    if (!this.sharingService || !this.shareMessage.trim() || !this.currentUser) return;
    try {
      const payload = {
        authorId: this.currentUser.id || this.currentUser._id || '',
        author: this.currentUser.fullname || 'Hộ kinh doanh xanh',
        text: this.shareMessage,
        rating: 5,
        tripName: this.sharingService.name,
        dest: this.sharingService.destination,
        days: 1,
        likes: 0,
        comments: 0,
        image: this.sharingService.image_url || 'image/Viet Nam.png',
        itineraryId: null,
        current_data: { serviceId: this.sharingService.id }
      };

      const ok = await this.apiService.addCommunityPost(payload);
      if (ok) {
        this.closeShareModal();
        this.showAlert('Đã chia sẻ dịch vụ lên cộng đồng GreenSteps thành công!', 'success');
      } else {
        this.showAlert('Chia sẻ lên cộng đồng thất bại!', 'error');
      }
    } catch (e) {
      console.error(e);
      this.showAlert('Lỗi chia sẻ dịch vụ!', 'error');
    }
  }

  // Details Modal
  public isDetailsModalOpen: boolean = false;
  public detailedService: any = null;

  // Filters State
  public searchQuery: string = '';
  public selectedTypes: string[] = [];
  public selectedLocations: string[] = [];
  public selectedStatuses: string[] = [];

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    public cdr: ChangeDetectorRef,
    private loginModalService: LoginModalService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (!user || user.role !== 'provider') {
        this.loginModalService.open();
      } else {
        this.loadServices();
        if (!this.autoAddOpened && this.route.snapshot.queryParamMap.get('action') === 'add') {
          this.autoAddOpened = true;
          this.openAddModal();
        }
      }
      this.cdr.detectChanges();
    });
  }

  public async loadServices() {
    if (!this.currentUser) return;
    const providerId = this.currentUser.id || this.currentUser._id || '';
    this.myServices = await this.apiService.getMyServices(providerId);
    this.cdr.detectChanges();
  }

  // Filter actions
  public toggleTypeFilter(type: string) {
    if (this.selectedTypes.includes(type)) {
      this.selectedTypes = this.selectedTypes.filter(t => t !== type);
    } else {
      this.selectedTypes.push(type);
    }
    this.cdr.detectChanges();
  }

  public toggleLocationFilter(loc: string) {
    if (this.selectedLocations.includes(loc)) {
      this.selectedLocations = this.selectedLocations.filter(l => l !== loc);
    } else {
      this.selectedLocations.push(loc);
    }
    this.cdr.detectChanges();
  }

  public toggleStatusFilter(status: string) {
    if (this.selectedStatuses.includes(status)) {
      this.selectedStatuses = this.selectedStatuses.filter(s => s !== status);
    } else {
      this.selectedStatuses.push(status);
    }
    this.cdr.detectChanges();
  }

  public clearAllFilters() {
    this.selectedTypes = [];
    this.selectedLocations = [];
    this.selectedStatuses = [];
    this.searchQuery = '';
    this.cdr.detectChanges();
  }

  public get filteredServices(): Service[] {
    return this.myServices.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchType = this.selectedTypes.length === 0 || this.selectedTypes.includes(s.type);
      const matchLocation = this.selectedLocations.length === 0 || this.selectedLocations.includes(s.destination);
      
      const status = s.status || 'active';
      const matchStatus = this.selectedStatuses.length === 0 || this.selectedStatuses.includes(status);
      
      return matchSearch && matchType && matchLocation && matchStatus;
    });
  }

  // Count calculations
  public get totalCount(): number {
    return this.myServices.length;
  }

  public get activeCount(): number {
    return this.myServices.filter(s => s.status === 'active').length;
  }

  public get pendingCount(): number {
    return this.myServices.filter(s => s.status === 'pending').length;
  }

  public get draftCount(): number {
    return this.myServices.filter(s => s.status === 'draft').length;
  }

  public getServiceImage(srv: Service): string {
    if (srv.image_url) return srv.image_url;
    if (srv.type === 'stay') {
      return 'image/1dc8619487310884c9d631d689ece1e7.jpg';
    } else if (srv.type === 'food') {
      return 'image/41a413334d9e3753b26c50f3a3921309.jpg';
    } else if (srv.type === 'transport') {
      return 'image/greensteps_logo.png';
    }
    return 'image/Gemini_Generated_Image_szp1ouszp1ouszp1.png';
  }

  public servicePrice(service: any): string {
    const status = service.current_data?.priceStatus || service.priceStatus;
    if (status === 'on_request') return 'Liên hệ báo giá';
    return Number(service.cost || 0).toLocaleString('vi-VN') + 'đ' + (status === 'reference' ? ' · tham khảo' : '');
  }
  public carbonConfirmed(service: any): boolean {
    return service.carbonKnown !== false && service.current_data?.carbonStatus !== 'unconfirmed';
  }
  public servicePolicyText(data: any): string {
    if (data?.policyGroups?.length) return data.policyGroups.flatMap((group: any) => group.lines).join('\n');
    return data?.policies?.join('\n') || data?.policy || '';
  }
  public amenityLabel(item: any): string { return typeof item === 'string' ? item : item.name; }

  private resetExtendedServiceFields() {
    this.roomDrafts = [];
    this.amenityGroupDrafts = [];
    this.popularAmenityDrafts = [];
    this.greenFeatureDrafts = [];
    this.policyGroupDrafts = [];
    this.areaDescription = '';
    this.nearbyGroupDrafts = [];
    this.locationLatitude = null;
    this.locationLongitude = null;
  }

  private buildPolicyGroups(): ServicePolicyGroup[] {
    const groups = this.policyGroupDrafts.map(group => ({
      title: group.title.trim(),
      lines: (group.lines || []).map(line => line.trim()).filter(Boolean)
    })).filter(group => group.title && group.lines.length);
    const cancellationLines = this.cancellationPolicy.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (cancellationLines.length) {
      const index = groups.findIndex(group => group.title.toLocaleLowerCase('vi') === 'chính sách dịch vụ');
      if (index >= 0) groups[index] = { ...groups[index], lines: cancellationLines };
      else groups.unshift({ title: 'Chính sách dịch vụ', lines: cancellationLines });
    }
    return groups;
  }

  public addRoom() {
    this.roomDrafts.push({ id: `room-${Date.now()}-${this.roomDrafts.length}`, name: '', images: [], amenities: [], policies: [] });
  }
  public removeRoom(index: number) { this.roomDrafts.splice(index, 1); }
  public setRoomPolicies(room: ServiceRoom, value: string) { room.policies = value.split(/\r?\n/); }
  public toggleRoomAmenity(index: number, amenity: string, selected: boolean) {
    const values = new Set(this.roomDrafts[index].amenities || []);
    selected ? values.add(amenity) : values.delete(amenity);
    this.roomDrafts[index].amenities = [...values];
  }
  public addAmenityGroup() { this.amenityGroupDrafts.push({ name: '', items: [] }); }
  public removeAmenityGroup(index: number) { this.amenityGroupDrafts.splice(index, 1); }
  public addAmenityItem(groupIndex: number) { this.amenityGroupDrafts[groupIndex].items.push({ name: '', fee: 'free', available: true, note: '' }); }
  public removeAmenityItem(groupIndex: number, itemIndex: number) { this.amenityGroupDrafts[groupIndex].items.splice(itemIndex, 1); }
  public setAmenityItemName(groupIndex: number, itemIndex: number, name: string) {
    const group = this.amenityGroupDrafts[groupIndex];
    const item = group.items[itemIndex];
    group.items[itemIndex] = typeof item === 'string' ? name : { ...item, name };
  }
  public addPopularAmenity() { this.popularAmenityDrafts.push(''); }
  public removePopularAmenity(index: number) { this.popularAmenityDrafts.splice(index, 1); }
  public addGreenFeature() { this.greenFeatureDrafts.push({ title: '', description: '' }); }
  public removeGreenFeature(index: number) { this.greenFeatureDrafts.splice(index, 1); }
  public addPolicyGroup() { this.policyGroupDrafts.push({ title: '', lines: [] }); }
  public removePolicyGroup(index: number) { this.policyGroupDrafts.splice(index, 1); }
  public setPolicyLines(group: ServicePolicyGroup, value: string) { group.lines = value.split(/\r?\n/); }
  public addNearbyGroup() { this.nearbyGroupDrafts.push({ name: '', items: [] }); }
  public removeNearbyGroup(index: number) { this.nearbyGroupDrafts.splice(index, 1); }
  public addNearbyPlace(groupIndex: number) { this.nearbyGroupDrafts[groupIndex].items.push({ name: '', distance: '' }); }
  public removeNearbyPlace(groupIndex: number, itemIndex: number) { this.nearbyGroupDrafts[groupIndex].items.splice(itemIndex, 1); }

  public async onRoomImageSelected(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    if (!file.type.startsWith('image/')) { this.showAlert('Vui lòng chọn tệp hình ảnh hợp lệ.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { this.showAlert('Ảnh quá lớn! Vui lòng chọn ảnh dưới 5MB.', 'error'); return; }
    const base64 = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    if (!base64) { this.showAlert('Không thể đọc ảnh vừa chọn.', 'error'); return; }
    const uploaded = await this.apiService.uploadImageBase64(base64, 'image');
    if (!uploaded.success || !uploaded.url) { this.showAlert('Tải ảnh phòng lên thất bại. Vui lòng thử lại.', 'error'); return; }
    this.roomDrafts[index].images = [...(this.roomDrafts[index].images || []), uploaded.url];
    this.cdr.detectChanges();
  }
  public removeRoomImage(roomIndex: number, imageIndex: number) { this.roomDrafts[roomIndex].images?.splice(imageIndex, 1); }

  public openAddModal() {
    this.editingServiceId = null;
    this.isAddModalOpen = true;
    this.currentStep = 1;
    this.serviceName = '';
    this.serviceType = 'tour'; // Default to tour type
    this.serviceCost = null;
    this.serviceCarbon = null;
    this.serviceAddress = '';
    this.maxCapacity = null;
    this.imageUrl = 'image/Viet Nam.png';
    this.galleryImages = [];
    this.openingSchedule = '';
    this.cancellationPolicy = '';
    this.itineraryText = '';

    this.childPrice = null;
    this.serviceDuration = '';
    this.serviceShortDesc = '';
    this.slotsPerDay = 1;
    this.startTime = '';
    this.notesForCustomers = '';
    this.resetExtendedServiceFields();
  }

  public async openEditModal(srv: Service) {
    this.editingServiceId = srv.id;
    this.isAddModalOpen = true;
    this.currentStep = 1;
    this.serviceName = srv.name;
    this.serviceType = srv.type;
    this.serviceCost = srv.cost;
    this.serviceCarbon = srv.carbon || null;
    this.serviceDest = srv.destination;
    
    const details = await this.apiService.getServiceDetails(srv.id);
    if (details) {
      this.serviceAddress = details.current_data?.address || '';
      this.maxCapacity = details.max_capacity || null;
      this.imageUrl = details.image_url || details.current_data?.img || 'image/Viet Nam.png';
      this.galleryImages = details.current_data?.images || details.current_data?.gallery || [];
      this.openingSchedule = details.current_data?.schedule || '';
      const savedPolicyGroups = details.current_data?.policyGroups || [];
      const servicePolicyGroup = savedPolicyGroups.find((group: ServicePolicyGroup) => group.title?.toLocaleLowerCase('vi') === 'chính sách dịch vụ');
      this.cancellationPolicy = details.current_data?.policy || servicePolicyGroup?.lines?.join('\n') || (savedPolicyGroups.length ? '' : this.servicePolicyText(details.current_data));
      this.itineraryText = details.current_data?.itinerary || details.current_data?.description || '';
      
      this.childPrice = details.current_data?.childPrice || null;
      this.serviceDuration = details.current_data?.duration || '';
      this.serviceShortDesc = details.current_data?.shortDesc || '';
      this.slotsPerDay = details.current_data?.slotsPerDay || 1;
      this.startTime = details.current_data?.startTime || '';
      this.notesForCustomers = details.current_data?.notesForCustomers || '';
      const currentData = details.current_data || {};
      this.roomDrafts = (currentData.rooms || []).map((room: ServiceRoom) => ({ ...room, images: [...(room.images || [])], amenities: [...(room.amenities || [])], policies: [...(room.policies || [])] }));
      this.amenityGroupDrafts = (currentData.amenityGroups || []).map((group: ServiceAmenityGroup) => ({ ...group, items: (group.items || []).map(item => typeof item === 'string' ? { name: item, fee: 'free', available: true, note: '' } : { ...item }) }));
      this.popularAmenityDrafts = (currentData.popularAmenities || []).map((item: ServiceAmenity) => this.amenityLabel(item));
      this.greenFeatureDrafts = (currentData.greenFeatures || []).map((feature: ServiceGreenFeature) => ({ ...feature }));
      this.policyGroupDrafts = (currentData.policyGroups || []).map((group: ServicePolicyGroup) => ({ ...group, lines: [...(group.lines || [])] }));
      this.areaDescription = currentData.areaDescription || '';
      this.nearbyGroupDrafts = (currentData.nearbyGroups || []).map((group: ServiceNearbyGroup) => ({ ...group, items: (group.items || []).map(item => ({ ...item })) }));
      this.locationLatitude = currentData.lat ?? null;
      this.locationLongitude = currentData.lng ?? null;
    } else {
      this.serviceAddress = (srv as any).address || (srv as any).current_data?.address || '';
      this.maxCapacity = srv.max_capacity || null;

      this.childPrice = null;
      this.serviceDuration = '';
      this.serviceShortDesc = '';
      this.slotsPerDay = 1;
      this.startTime = '';
      this.notesForCustomers = '';
      this.resetExtendedServiceFields();
    }
    this.cdr.detectChanges();
  }

  public closeAddModal() {
    this.isAddModalOpen = false;
    this.editingServiceId = null;
    this.currentStep = 1;
  }

  // Wizard Navigation
  public nextStep() {
    if (this.currentStep < this.serviceFormSteps.length) {
      this.currentStep++;
      this.cdr.detectChanges();
    }
  }

  public prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.cdr.detectChanges();
    }
  }

  public goToStep(step: number) {
    if (step >= 1 && step <= this.serviceFormSteps.length) this.currentStep = step;
    this.cdr.detectChanges();
  }

  // Details modal
  public async openDetailsModal(srv: Service) {
    const details = await this.apiService.getServiceDetails(srv.id);
    this.detailedService = details ? { ...details, name: details.name_service } : srv;
    this.isDetailsModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeDetailsModal() {
    this.isDetailsModalOpen = false;
    this.detailedService = null;
    this.cdr.detectChanges();
  }

  // Quick actions
  public async cloneService(srv: Service) {
    this.showConfirm(`Bạn có chắc chắn muốn nhân bản dịch vụ "${srv.name}"?`, async () => {
      const ok = await this.apiService.cloneService(srv.id);
      if (ok) {
        this.showAlert('Nhân bản dịch vụ thành công!', 'success');
        await this.loadServices();
      } else {
        this.showAlert('Lỗi nhân bản dịch vụ!', 'error');
      }
    });
  }

  public async suspendService(srv: Service) {
    this.showConfirm(`Bạn có chắc chắn muốn tạm ngừng hoạt động dịch vụ "${srv.name}"?`, async () => {
      const ok = await this.apiService.suspendService(srv.id);
      if (ok) {
        this.showAlert('Đã tạm ngừng hoạt động dịch vụ!', 'success');
        await this.loadServices();
      } else {
        this.showAlert('Lỗi khi tạm ngừng dịch vụ!', 'error');
      }
    });
  }

  public async resendServiceApproval(srv: Service) {
    this.showConfirm(`Bạn muốn gửi duyệt lại dịch vụ "${srv.name}"?`, async () => {
      const ok = await this.apiService.resendServiceApproval(srv.id);
      if (ok) {
        this.showAlert('Đã gửi duyệt lại dịch vụ xanh!', 'success');
        await this.loadServices();
      } else {
        this.showAlert('Lỗi gửi duyệt lại!', 'error');
      }
    });
  }

  public getStatusLabel(status?: string): string {
    const s = status || 'active';
    switch (s) {
      case 'draft': return 'Bản nháp';
      case 'pending': return 'Chờ duyệt';
      case 'approved': return 'Đã duyệt';
      case 'rejected': return 'Bị từ chối';
      case 'active': return 'Đang hoạt động';
      case 'suspended': return 'Tạm ngừng';
      case 'expired': return 'Hết thời hạn';
      default: return 'Hoạt động';
    }
  }

  public toggleBadge(badge: string) {
    const idx = this.selectedBadges.indexOf(badge);
    if (idx >= 0) {
      this.selectedBadges.splice(idx, 1);
    } else {
      this.selectedBadges.push(badge);
    }
    this.cdr.detectChanges();
  }

  public exportServicesList() {
    let csv = "Tên dịch vụ,Loại hình,Khu vực,Giá dịch vụ,Trạng thái\n";
    this.myServices.forEach(srv => {
      csv += `"${srv.name}","${srv.type}","${srv.destination}",${srv.cost},"${this.getStatusLabel(srv.status)}"\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "danh_sach_dich_vu.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  public async submitNewService(event: Event) {
    if (event) event.preventDefault();
    if (!this.currentUser) return;

    const providerId = this.currentUser.id || this.currentUser._id || '';
    const categoryMap: Record<string, string> = { stay: 'Lưu trú', food: 'Ăn uống', tour: 'Tour', transport: 'Di chuyển', attraction: 'Giải trí' };

    let resolvedLat: number | null = this.locationLatitude;
    let resolvedLng: number | null = this.locationLongitude;

    if (this.serviceAddress) {
      try {
        const query = `${this.serviceAddress}, ${this.serviceDest}, Vietnam`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        
        const res = await Promise.race([
          fetch(url, { headers: { 'User-Agent': 'GreenStepsApp/1.0' } }).then(r => r.json()),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1200))
        ]) as any[];

        if (res && res.length > 0) {
          resolvedLat = this.locationLatitude ?? parseFloat(res[0].lat);
          resolvedLng = this.locationLongitude ?? parseFloat(res[0].lon);
        }
      } catch (e) {
        console.warn('Geocoding failed, falling back to null', e);
      }
    }

    const currentData = {
      lat: resolvedLat,
      lng: resolvedLng,
      address: this.serviceAddress,
      category: categoryMap[this.serviceType] || 'Khám phá',
      img: this.imageUrl || 'image/Viet Nam.png',
      images: this.galleryImages,
      gallery: this.galleryImages,
      schedule: this.openingSchedule,
      policy: this.cancellationPolicy,
      itinerary: this.itineraryText,
      duration: this.serviceDuration,
      shortDesc: this.serviceShortDesc,
      childPrice: this.childPrice ? Number(this.childPrice) : null,
      slotsPerDay: Number(this.slotsPerDay),
      startTime: this.startTime,
      notesForCustomers: this.notesForCustomers,
      description: this.serviceShortDesc || this.itineraryText,
      rooms: this.roomDrafts.filter(room => room.name?.trim()).map(room => ({ ...room, name: room.name.trim() })),
      amenityGroups: this.amenityGroupDrafts
        .filter(group => group.name?.trim() || group.items?.length)
        .map(group => ({ ...group, name: group.name.trim(), items: (group.items || []).filter(item => this.amenityLabel(item).trim()) })),
      popularAmenities: this.popularAmenityDrafts.filter(item => this.amenityLabel(item).trim()),
      greenFeatures: this.greenFeatureDrafts.filter(feature => feature.title?.trim()).map(feature => ({ ...feature, title: feature.title.trim() })),
      policyGroups: this.buildPolicyGroups(),
      policies: this.buildPolicyGroups().flatMap(group => group.lines),
      areaDescription: this.areaDescription.trim(),
      nearbyGroups: this.nearbyGroupDrafts
        .filter(group => group.name?.trim() || group.items?.length)
        .map(group => ({ ...group, name: group.name.trim(), items: (group.items || []).filter(item => item.name?.trim()) }))
    };

    if (this.editingServiceId) {
      const updateData = {
        name: this.serviceName,
        type: this.serviceType,
        destination: this.serviceDest,
        cost: Number(this.serviceCost),
        carbon: Number(this.serviceCarbon),
        lat: resolvedLat,
        lng: resolvedLng,
        address: this.serviceAddress,
        category: categoryMap[this.serviceType] || 'Khám phá',
        status: 'pending',
        maxCapacity: this.maxCapacity,
        imageUrl: this.imageUrl,
        current_data: currentData
      };

      const success = await this.apiService.updateMyService(this.editingServiceId, updateData);
      if (success) {
        this.showAlert('Cập nhật dịch vụ xanh và gửi kiểm duyệt thành công!', 'success');
        this.isAddModalOpen = false;
        this.editingServiceId = null;
        await this.loadServices();
      } else {
        this.showAlert('Có lỗi xảy ra khi cập nhật dịch vụ.', 'error');
      }
    } else {
      const newService = {
        id: 'ser_' + Date.now(),
        providerId: providerId,
        name: this.serviceName,
        type: this.serviceType,
        destination: this.serviceDest,
        cost: Number(this.serviceCost),
        carbon: Number(this.serviceCarbon),
        lat: resolvedLat,
        lng: resolvedLng,
        address: this.serviceAddress,
        category: categoryMap[this.serviceType] || 'Khám phá',
        badges: ['green'],
        status: 'pending',
        maxCapacity: this.maxCapacity,
        imageUrl: this.imageUrl,
        current_data: currentData
      };

      const success = await this.apiService.addMyService(newService);
      if (success) {
        this.showAlert('Đăng ký dịch vụ xanh mới thành công! Dịch vụ đang ở trạng thái Chờ duyệt.', 'success');
        this.isAddModalOpen = false;
        await this.loadServices();
      } else {
        this.showAlert('Có lỗi xảy ra khi thêm dịch vụ.', 'error');
      }
    }
    this.cdr.detectChanges();
  }

  public getActivityTypeLabel(type: string): string {
    if (type === "stay" || type === "lodging") return "Lưu trú";
    if (type === "food" || type === "dining") return "Ăn uống";
    if (type === "transport") return "Di chuyển";
    if (type === "tour") return "Tour";
    return "Giải trí";
  }

  public onCostOrTypeChange() {
    if (this.serviceCost === null || this.serviceCost === undefined || this.serviceCost <= 0) {
      this.serviceCarbon = null;
      return;
    }
    const cost = Number(this.serviceCost);
    let calculated = 0;
    switch (this.serviceType) {
      case 'stay':
        calculated = 2.5 + Math.min(7.5, cost / 500000);
        break;
      case 'food':
        calculated = 1.0 + Math.min(4.0, cost / 300000);
        break;
      case 'transport':
        calculated = 0.5 + Math.min(7.5, cost / 200000);
        break;
      case 'tour':
        calculated = 1.5 + Math.min(10.0, cost / 200000);
        break;
      case 'attraction':
      default:
        calculated = 1.0 + Math.min(14.0, cost / 200000);
        break;
    }
    this.serviceCarbon = Math.round(calculated * 10) / 10;
    this.cdr.detectChanges();
  }

  public saveDraft() {
    this.showAlert('Đã lưu bản nháp thành công!', 'success');
    this.closeAddModal();
  }

  public previewService() {
    this.showAlert('Đang tải chế độ xem trước dịch vụ...', 'info');
  }

  public onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.uploadSingleFile(file);
    }
  }

  private uploadSingleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      this.showAlert('File quá lớn! Vui lòng chọn ảnh dưới 5MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.imageUrl = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  public onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
    this.cdr.detectChanges();
  }

  public onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    this.cdr.detectChanges();
  }

  public onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.uploadSingleFile(file);
    }
  }

  public removeImage(event: Event) {
    event.stopPropagation();
    this.imageUrl = '';
    this.cdr.detectChanges();
  }

  public onGalleryFilesSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          this.showAlert(`Ảnh "${file.name}" quá lớn! Vui lòng chọn ảnh dưới 5MB.`, 'error');
          continue;
        }
        const reader = new FileReader();
        reader.onload = () => {
          this.galleryImages.push(reader.result as string);
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      }
    }
  }

  public removeGalleryImage(index: number, event: Event) {
    event.stopPropagation();
    this.galleryImages.splice(index, 1);
    this.cdr.detectChanges();
  }
}

export { PartnerServicesComponent as PartnerServices };
