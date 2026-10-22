import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';
import { User, CommunityPost, Itinerary } from '../../models/models';

@Component({
  selector: 'app-community',
  standalone: false,
  templateUrl: './community.html',
})
export class CommunityComponent implements OnInit {
  public currentUser: User | null = null;
  public posts: CommunityPost[] = [];

  // Pagination & Loading States
  public page: number = 0;
  public limit: number = 5;
  public isPageLoading: boolean = true;
  public isLoadingMore: boolean = false;
  public hasMorePosts: boolean = true;

  // New post form bindings
  public postText: string = '';
  public postDest: string = 'Đà Lạt';
  public postDays: number = 3;
  public postRating: number = 5;
  public postImage: string = '';
  public isUploading: boolean = false;
  
  // Custom Share Itinerary variables
  public userItineraries: Itinerary[] = [];
  public selectedItineraryId: string = '';
  public activeDropdownPostId: string | null = null;


  // Comments bindings
  public expandedComments: { [postId: string]: boolean } = {};
  public postComments: { [postId: string]: any[] } = {};
  public isCommentLoading: { [postId: string]: boolean } = {};
  public commentInputs: { [postId: string]: string } = {};
  public activeReplyTarget: { [commentId: string]: boolean } = {};
  public replyInputs: { [commentId: string]: string } = {};

  // Service detail modal bindings
  public detailedService: any = null;
  public isDetailsModalOpen: boolean = false;

  public getServiceImage(srv: any): string {
    if (!srv) return 'image/Viet Nam.png';
    return srv.image_url || srv.current_data?.img || 'image/Viet Nam.png';
  }

  public async viewSharedService(serviceId: string, event: Event) {
    event.stopPropagation();
    try {
      const details = await this.apiService.getServiceDetails(serviceId);
      this.detailedService = details ? { ...details, name: details.name_service } : null;
      if (this.detailedService) {
        this.isDetailsModalOpen = true;
      } else {
        this.showAlert("Không tìm thấy", "Dịch vụ xanh này không tồn tại hoặc đã bị gỡ bỏ.", "error");
      }
      this.cdr.detectChanges();
    } catch (e) {
      this.showAlert("Lỗi", "Không thể lấy thông tin chi tiết dịch vụ.", "error");
    }
  }

  public closeDetailsModal() {
    this.isDetailsModalOpen = false;
    this.detailedService = null;
    this.cdr.detectChanges();
  }

  public likedPostsSet = new Set<string>();

  // New post optional details toggle
  public showPostDetails: boolean = false;

  // Comment image drafts & upload state maps
  public commentImageDrafts: { [postId: string]: string } = {};
  public isCommentUploading: { [postId: string]: boolean } = {};

  // Custom Alert Modal properties
  public alertVisible = false;
  public alertTitle = '';
  public alertMessage = '';
  public alertType: 'warning' | 'info' | 'error' = 'info';
  public alertIcon = 'bi-info-circle-fill';
  private alertCallback: (() => void) | null = null;

  // Custom Confirm variables
  public confirmVisible = false;
  public confirmTitle = '';
  public confirmMessage = '';
  private confirmCallback: ((confirm: boolean) => void) | null = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private loginModalService: LoginModalService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  public showAlert(title: string, message: string, type: 'warning' | 'info' | 'error' | 'success' = 'info', callback?: () => void) {
    this.alertTitle = title;
    this.alertMessage = message;
    this.alertType = type === 'success' ? 'info' : type;
    this.alertCallback = callback || null;
    
    if (type === 'warning') this.alertIcon = 'bi-exclamation-triangle-fill text-amber-500';
    else if (type === 'error') this.alertIcon = 'bi-x-circle-fill text-red-500';
    else if (type === 'success') this.alertIcon = 'bi-check-circle-fill text-emerald-500';
    else this.alertIcon = 'bi-info-circle-fill text-blue-500';

    this.alertVisible = true;
    this.cdr.detectChanges();
  }

  public closeAlert() {
    this.alertVisible = false;
    if (this.alertCallback) {
      this.alertCallback();
      this.alertCallback = null;
    }
    this.cdr.detectChanges();
  }

  public showConfirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmTitle = title;
      this.confirmMessage = message;
      this.confirmCallback = (confirmed) => {
        resolve(confirmed);
      };
      this.confirmVisible = true;
      this.cdr.detectChanges();
    });
  }

  public closeConfirm(confirm: boolean) {
    this.confirmVisible = false;
    if (this.confirmCallback) {
      this.confirmCallback(confirm);
      this.confirmCallback = null;
    }
    this.cdr.detectChanges();
  }

  public showCommunityFeature(name: string, description: string) {
    this.showAlert(name, description, 'info');
  }

  async ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadUserItineraries(user.id || user._id || '');
      }
      this.cdr.detectChanges();
    });

    // Load liked posts
    const liked = JSON.parse(localStorage.getItem('greensteps_liked_posts') || '[]');
    this.likedPostsSet = new Set<string>(liked);

    await this.loadPosts();
  }

  public preloadCommentsForSinglePost(postId: string) {
    if (this.postComments[postId] || this.isCommentLoading[postId]) return;
    this.isCommentLoading[postId] = true;
    
    this.apiService.getPostComments(postId).then(comments => {
      this.postComments[postId] = comments;
      this.isCommentLoading[postId] = false;
      this.cdr.detectChanges();
    }).catch(err => {
      console.error(`Failed to preload comments for post ${postId}:`, err);
      this.isCommentLoading[postId] = false;
      this.cdr.detectChanges();
    });
  }

  public checkAndPreloadVisiblePosts() {
    setTimeout(() => {
      this.posts.forEach(post => {
        if (this.postComments[post.id] || this.isCommentLoading[post.id]) {
          return;
        }

        const element = document.getElementById(`post-card-${post.id}`);
        if (element) {
          const rect = element.getBoundingClientRect();
          const windowHeight = window.innerHeight || document.documentElement.clientHeight;
          
          // Preload comments if the post card is within viewport or close to it (within 750px of top/bottom)
          const isNearViewport = rect.top < windowHeight + 750 && rect.bottom > -750;
          if (isNearViewport) {
            this.preloadCommentsForSinglePost(post.id);
          }
        }
      });
    }, 100);
  }

  private async loadPosts() {
    this.isPageLoading = true;
    this.page = 0;
    this.hasMorePosts = true;
    this.posts = await this.apiService.getCommunityPosts(this.page, this.limit);
    if (this.posts.length < this.limit) {
      this.hasMorePosts = false;
    }
    this.isPageLoading = false;
    this.cdr.detectChanges();

    // Trigger preloading check for initially visible posts
    this.checkAndPreloadVisiblePosts();
  }

  public async loadMorePosts() {
    if (this.isLoadingMore || !this.hasMorePosts) return;
    this.isLoadingMore = true;
    this.page++;
    this.cdr.detectChanges();

    try {
      const nextPosts = await this.apiService.getCommunityPosts(this.page, this.limit);
      if (nextPosts.length < this.limit) {
        this.hasMorePosts = false;
      }
      this.posts = [...this.posts, ...nextPosts];
      
      // Trigger preloading check for newly loaded posts
      this.checkAndPreloadVisiblePosts();
    } catch (e) {
      console.error('Error loading more posts:', e);
    } finally {
      this.isLoadingMore = false;
      this.cdr.detectChanges();
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    const pos = (document.documentElement.scrollTop || document.body.scrollTop) + document.documentElement.clientHeight;
    const max = document.documentElement.scrollHeight;
    
    // Load next batch when user is within 1200px (about 2-3 post cards) of the page bottom
    if (pos >= max - 1200) {
      this.loadMorePosts();
    }
    
    // Check and preload comments for posts near the scrolled viewport
    this.checkAndPreloadVisiblePosts();
  }


  public async loadUserItineraries(userId: string) {
    try {
      this.userItineraries = await this.apiService.getItineraries(userId);
      this.cdr.detectChanges();
    } catch (e) {
      console.error(e);
    }
  }

  public getFilteredUserItineraries(): Itinerary[] {
    if (!this.postDest) return [];
    const target = this.postDest.toLowerCase().trim();
    
    return this.userItineraries.filter(iti => {
      const dest = (iti.destination || '').toLowerCase().trim();
      
      if (target.includes('đà nẵng') || target.includes('hội an') || target.includes('da nang') || target.includes('hoi an')) {
        return dest.includes('đà nẵng') || dest.includes('hội an') || dest.includes('da nang') || dest.includes('hoi an');
      }
      
      return dest.includes(target);
    });
  }

  public onDestinationChange() {
    if (this.selectedItineraryId) {
      const filtered = this.getFilteredUserItineraries();
      const stillValid = filtered.some(i => i.id === this.selectedItineraryId);
      if (!stillValid) {
        this.selectedItineraryId = '';
      }
    }
  }

  public getSelectedItineraryDays(): number {
    if (!this.selectedItineraryId) return 3;
    const selected = this.userItineraries.find(i => i.id === this.selectedItineraryId);
    return selected ? selected.days : 3;
  }

  public setRating(stars: number) {
    this.postRating = stars;
  }

  public onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const base64 = e.target.result;
      this.isUploading = true;
      this.cdr.detectChanges();

      const res = await this.apiService.uploadImageBase64(base64, 'post');
      this.isUploading = false;
      if (res && res.success) {
        this.postImage = res.url;
      } else {
        this.showAlert("Thất bại", "Không thể tải ảnh lên!", "error");
      }
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  public checkLoginAction(): boolean {
    if (!this.currentUser) {
      this.showAlert("Thông báo", "Vui lòng đăng nhập để thực hiện chức năng này!", "warning", () => {
        this.loginModalService.open();
      });
      return false;
    }
    return true;
  }

  public openComposer() {
    if (this.checkLoginAction()) {
      this.showPostDetails = true;
      this.cdr.detectChanges();
    }
  }

  public async submitPost(event: Event) {
    event.preventDefault();
    if (!this.checkLoginAction() || !this.currentUser) return;
    if (!this.postText.trim()) return;

    const authorName = this.currentUser.fullname || '';
    const authorId = this.currentUser.id || this.currentUser._id || '';

    const selectedIti = this.selectedItineraryId ? this.userItineraries.find(i => i.id === this.selectedItineraryId) : null;

    const newPost = {
      authorId: authorId,
      author: authorName,
      text: this.postText,
      rating: this.postRating,
      tripName: selectedIti ? selectedIti.name : `Hành trình ${this.postDest} ${this.postDays} ngày`,
      dest: selectedIti ? selectedIti.destination : this.postDest,
      days: selectedIti ? selectedIti.days : Number(this.postDays),
      likes: 0,
      comments: 0,
      image: this.postImage || null,
      itineraryId: this.selectedItineraryId || null
    };

    const success = await this.apiService.addCommunityPost(newPost);
    if (success) {
      this.postText = '';
      this.postRating = 5;
      this.postImage = '';
      this.selectedItineraryId = '';
      this.showPostDetails = false;
      await this.loadPosts();
    } else {
      this.showAlert("Lỗi", "Đăng bài viết thất bại. Vui lòng kiểm tra kết nối mạng!", "error");
    }
  }

  public togglePostDropdown(postId: string, event: Event) {
    event.stopPropagation();
    if (this.activeDropdownPostId === postId) {
      this.activeDropdownPostId = null;
    } else {
      this.activeDropdownPostId = postId;
    }
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  public onDocumentClick() {
    if (this.activeDropdownPostId) {
      this.activeDropdownPostId = null;
      this.cdr.detectChanges();
    }
  }

  public async deletePost(postId: string, event: Event) {
    event.stopPropagation();
    const confirmDelete = await this.showConfirm("Xóa bài viết", "Bạn có chắc chắn muốn xóa bài viết này không?");
    if (!confirmDelete) return;

    const success = await this.apiService.deleteCommunityPost(postId);
    if (success) {
      this.showAlert("Thành công", "Đã xóa bài viết thành công!", "success");
      await this.loadPosts();
    } else {
      this.showAlert("Lỗi", "Xóa bài viết thất bại hoặc bạn không có quyền!", "error");
    }
  }

  public async referenceItinerary(itiId: string, event: Event) {
    event.stopPropagation();
    if (!this.currentUser) {
      this.showAlert("Thông báo", "Vui lòng đăng nhập để tham khảo lịch trình!", "warning");
      return;
    }
    const currentUserId = this.currentUser.id || this.currentUser._id || '';
    const confirmRef = await this.showConfirm("Tham khảo lịch trình", "Hệ thống sẽ tạo bản sao lịch trình này vào danh sách của bạn để biên tập. Bắt đầu sao chép?");
    if (!confirmRef) return;

    const res = await this.apiService.cloneItinerary(itiId, currentUserId);
    if (res && res.success) {
      this.showAlert("Thành công", "Sao chép lịch trình thành công! Hệ thống sẽ chuyển hướng bạn đến trang biên tập lịch trình ngay bây giờ.", "success", () => {
        this.router.navigate(['/schedule', res.newItineraryId]);
      });
    } else {
      this.showAlert("Lỗi", res.message || "Sao chép lịch trình thất bại!", "error");
    }
  }

  public async handleLike(post: CommunityPost) {
    if (!this.checkLoginAction()) return;
    const isLiked = this.likedPostsSet.has(post.id);
    const originalLikes = post.likes;

    if (isLiked) {
      // 1. OPTIMISTIC UNLIKE
      post.likes = Math.max(0, (post.likes || 0) - 1);
      this.likedPostsSet.delete(post.id);
      localStorage.setItem('greensteps_liked_posts', JSON.stringify(Array.from(this.likedPostsSet)));
      this.cdr.detectChanges();

      try {
        const res = await this.apiService.unlikePost(post.id);
        if (res && res.success) {
          post.likes = res.likes;
          this.cdr.detectChanges();
        } else {
          throw new Error('API reported failure');
        }
      } catch (e) {
        // Rollback unlike
        post.likes = originalLikes;
        this.likedPostsSet.add(post.id);
        localStorage.setItem('greensteps_liked_posts', JSON.stringify(Array.from(this.likedPostsSet)));
        this.cdr.detectChanges();
        this.showAlert("Lỗi", "Bỏ thích thất bại!", "error");
      }
    } else {
      // 2. OPTIMISTIC LIKE
      post.likes = (post.likes || 0) + 1;
      this.likedPostsSet.add(post.id);
      localStorage.setItem('greensteps_liked_posts', JSON.stringify(Array.from(this.likedPostsSet)));
      this.cdr.detectChanges();

      try {
        const res = await this.apiService.likePost(post.id);
        if (res && res.success) {
          post.likes = res.likes;
          this.cdr.detectChanges();
        } else {
          throw new Error('API reported failure');
        }
      } catch (e) {
        // Rollback like
        post.likes = originalLikes;
        this.likedPostsSet.delete(post.id);
        localStorage.setItem('greensteps_liked_posts', JSON.stringify(Array.from(this.likedPostsSet)));
        this.cdr.detectChanges();
        this.showAlert("Lỗi", "Thích bài viết thất bại!", "error");
      }
    }
  }

  public async toggleComments(post: CommunityPost) {
    const postId = post.id;
    this.expandedComments[postId] = !this.expandedComments[postId];
    if (this.expandedComments[postId]) {
      // Only make API call if comments have not been preloaded yet
      if (!this.postComments[postId]) {
        await this.loadComments(postId);
      }
    }
    this.cdr.detectChanges();
  }

  public async loadComments(postId: string) {
    this.isCommentLoading[postId] = true;
    this.cdr.detectChanges();
    try {
      const comments = await this.apiService.getPostComments(postId);
      this.postComments[postId] = comments;
    } catch (e) {
      console.error(e);
    } finally {
      this.isCommentLoading[postId] = false;
      this.cdr.detectChanges();
    }
  }

  public toggleReplyBox(commentId: string) {
    this.activeReplyTarget[commentId] = !this.activeReplyTarget[commentId];
    if (this.activeReplyTarget[commentId]) {
      this.replyInputs[commentId] = '';
    }
    this.cdr.detectChanges();
  }

  public async submitComment(postId: string, parentCommentId?: string) {
    if (!this.checkLoginAction() || !this.currentUser) return;
    const text = parentCommentId ? this.replyInputs[parentCommentId] : this.commentInputs[postId];
    if (!text || !text.trim()) return;

    const authorName = this.currentUser.fullname || '';
    const authorId = this.currentUser.id || this.currentUser._id || '';
    const imageUrl = parentCommentId ? '' : (this.commentImageDrafts[postId] || '');

    // 1. Save original state for potential rollback
    const previousComments = this.postComments[postId] ? [...this.postComments[postId]] : [];
    const post = this.posts.find(p => p.id === postId);
    const previousCommentsCount = post ? post.comments : 0;

    // 2. Create a temporary local comment object for instant visual feedback
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const tempComment = {
      id: tempId,
      text: text,
      parentCommentId: parentCommentId || null,
      createdAt: new Date().toISOString(),
      imageUrl: imageUrl || null,
      user: {
        fullname: authorName,
        avatar: this.currentUser && this.currentUser.avatarUrl ? this.currentUser.avatarUrl : authorName.charAt(0).toUpperCase()
      },
      replies: []
    };

    // Initialize list if undefined
    this.postComments[postId] = this.postComments[postId] || [];

    // 3. Optimistically insert the comment locally
    if (parentCommentId) {
      const parent = this.postComments[postId].find(c => c.id === parentCommentId);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(tempComment);
      }
    } else {
      this.postComments[postId].push(tempComment);
    }

    // Increment comments counter
    if (post) {
      post.comments = (post.comments || 0) + 1;
    }

    // Clear inputs immediately so user can type next comment without delay
    if (parentCommentId) {
      this.replyInputs[parentCommentId] = '';
      this.activeReplyTarget[parentCommentId] = false;
    } else {
      this.commentInputs[postId] = '';
      this.commentImageDrafts[postId] = '';
    }
    
    // Ensure parent comments box is expanded so they see their comment
    this.expandedComments[postId] = true;
    this.cdr.detectChanges();

    try {
      // 4. Send API request in background
      const res = await this.apiService.addPostComment(postId, text, parentCommentId, authorId, authorName, imageUrl);
      if (res && res.success) {
        // Silently reload official comments from server to get correct database IDs and replies tree
        await this.loadComments(postId);
      } else {
        throw new Error('Comment insertion failed');
      }
    } catch (e) {
      // 5. Rollback on failure
      this.postComments[postId] = previousComments;
      if (post) {
        post.comments = previousCommentsCount;
      }
      
      // Restore inputs so they don't lose their typed message
      if (parentCommentId) {
        this.replyInputs[parentCommentId] = text;
        this.activeReplyTarget[parentCommentId] = true;
      } else {
        this.commentInputs[postId] = text;
        if (imageUrl) this.commentImageDrafts[postId] = imageUrl;
      }
      
      this.cdr.detectChanges();
      this.showAlert("Thất bại", "Đăng bình luận thất bại!", "error");
    }
  }

  // Comment Image Upload Handlers
  public onCommentFileSelected(event: any, postId: string) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const base64 = e.target.result;
      this.isCommentUploading[postId] = true;
      this.cdr.detectChanges();

      try {
        const res = await this.apiService.uploadImageBase64(base64, 'post');
        this.isCommentUploading[postId] = false;
        if (res && res.success) {
          this.commentImageDrafts[postId] = res.url;
        } else {
          this.showAlert("Thất bại", "Không thể tải ảnh lên bình luận!", "error");
        }
      } catch (err) {
        this.isCommentUploading[postId] = false;
        this.showAlert("Lỗi", "Lỗi tải ảnh lên!", "error");
      }
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  public removeCommentImage(postId: string) {
    this.commentImageDrafts[postId] = '';
  }

  public getFirstLetter(name: string): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  public isAvatarUrl(avatar: string | undefined | null): boolean {
    if (!avatar) return false;
    return avatar.trim().length > 1;
  }

  // Lightbox Theater View Methods
  public activeLightboxImage: string | null = null;

  public openLightbox(imageUrl: string) {
    this.activeLightboxImage = imageUrl;
    this.cdr.detectChanges();
  }

  public closeLightbox() {
    this.activeLightboxImage = null;
    this.cdr.detectChanges();
  }
}

export { CommunityComponent as Community };
