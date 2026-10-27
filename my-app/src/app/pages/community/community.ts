import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';
import { CommunityPost, Itinerary, User } from '../../models/models';

type CommunityTab = 'all' | 'reel' | 'question';
type ComposerType = 'post' | 'reel' | 'question';

@Component({
  selector: 'app-community',
  standalone: false,
  templateUrl: './community.html',
  styleUrl: './community.css'
})
export class CommunityComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  public currentUser: User | null = null;
  public posts: CommunityPost[] = [];
  public itineraries: Itinerary[] = [];
  public challenge: any = null;
  public leaderboard: any[] = [];
  public trendingHashtags: Array<{ tag: string; count: number }> = [];
  public activeTab: CommunityTab = 'all';
  public query = '';
  public loading = true;
  public loadingMore = false;
  public hasMore = true;
  public page = 0;
  public submitting = false;
  public composerOpen = false;
  public composerType: ComposerType = 'post';
  public draftText = '';
  public draftLocation = '';
  public draftHashtags = '';
  public draftImages: string[] = [];
  public draftVideo = '';
  public selectedItineraryId = '';
  public selectedChallengeId = '';
  public editTarget: CommunityPost | null = null;
  public comments: Record<string, any[]> = {};
  public commentsOpen = new Set<string>();
  public commentsLoading = new Set<string>();
  public commentDrafts: Record<string, string> = {};
  public replyTo: Record<string, string> = {};
  public replyDrafts: Record<string, string> = {};
  public mediaUploading = false;
  public errorMessage = '';
  private searchTimer?: ReturnType<typeof setTimeout>;
  private readonly liked = new Set<string>(JSON.parse(localStorage.getItem('greensteps_liked_posts') || '[]'));

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly login: LoginModalService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.auth.currentUser$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(user => {
      this.currentUser = user;
      if (user) this.loadItineraries(user.id || user._id || '');
      this.cdr.markForCheck();
    });
    void this.refreshPage();
  }

  get userId(): string { return this.currentUser?.id || this.currentUser?._id || ''; }
  get selectedItinerary(): Itinerary | undefined { return this.itineraries.find(item => item.id === this.selectedItineraryId); }
  get hashtagList(): string[] {
    return [...new Set(this.draftHashtags.match(/#[\p{L}\p{N}_]+/gu)?.map(tag => tag.slice(1)) || [])].slice(0, 12);
  }

  async refreshPage(): Promise<void> {
    this.loading = true;
    this.page = 0;
    this.hasMore = true;
    this.api.clearCache('community_posts_');
    const type = this.activeTab === 'all' ? 'all' : this.activeTab;
    const [posts, challenge, ranking, tags] = await Promise.all([
      this.api.getCommunityPosts(0, 10, type, this.query),
      this.api.getCommunityChallenge(),
      this.api.getCommunityLeaderboard(3),
      this.api.getTrendingCommunityHashtags()
    ]);
    this.posts = posts;
    this.hasMore = posts.length === 10;
    this.challenge = challenge;
    this.leaderboard = ranking;
    this.trendingHashtags = tags;
    this.loading = false;
    this.cdr.markForCheck();
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;
    const nextPage = this.page + 1;
    const type = this.activeTab === 'all' ? 'all' : this.activeTab;
    const posts = await this.api.getCommunityPosts(nextPage, 10, type, this.query);
    this.page = nextPage;
    this.posts = [...this.posts, ...posts];
    this.hasMore = posts.length === 10;
    this.loadingMore = false;
    this.cdr.markForCheck();
  }

  changeTab(tab: CommunityTab): void {
    this.activeTab = tab;
    void this.refreshPage();
  }

  searchChanged(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.refreshPage(), 250);
  }

  private async loadItineraries(userId: string): Promise<void> {
    if (!userId) return;
    this.itineraries = await this.api.getItineraries(userId);
    this.cdr.markForCheck();
  }

  requireLogin(): boolean {
    if (this.currentUser) return true;
    this.login.open();
    return false;
  }

  openComposer(type: ComposerType = 'post', challenge = false): void {
    if (!this.requireLogin()) return;
    this.resetComposer();
    this.composerType = type;
    if (challenge && this.challenge) {
      this.selectedChallengeId = this.challenge.id;
      this.draftHashtags = `#${this.challenge.hashtag}`;
    }
    this.composerOpen = true;
  }

  editPost(post: CommunityPost): void {
    if (!this.requireLogin()) return;
    if (post.authorId !== this.userId) return;
    this.editTarget = post;
    this.composerType = post.postType || 'post';
    this.draftText = post.text;
    this.draftLocation = post.location || post.dest || '';
    this.draftHashtags = (post.hashtags || []).map(tag => `#${tag}`).join(' ');
    this.draftImages = [...(post.images || (post.image ? [post.image] : []))];
    this.draftVideo = post.videoUrl || '';
    this.selectedItineraryId = post.itinerary_id || '';
    this.composerOpen = true;
  }

  closeComposer(): void { this.composerOpen = false; this.resetComposer(); }

  private resetComposer(): void {
    this.editTarget = null;
    this.draftText = '';
    this.draftLocation = '';
    this.draftHashtags = '';
    this.draftImages = [];
    this.draftVideo = '';
    this.selectedItineraryId = '';
    this.selectedChallengeId = '';
    this.errorMessage = '';
  }

  async selectImages(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files || [])];
    input.value = '';
    if (this.draftImages.length + files.length > 8) { this.errorMessage = 'Bạn có thể thêm tối đa 8 hình ảnh.'; return; }
    if (files.some(file => !file.type.startsWith('image/') || file.size > 8 * 1024 * 1024)) { this.errorMessage = 'Mỗi hình ảnh cần đúng định dạng và nhỏ hơn 8 MB.'; return; }
    await this.uploadFiles(files, 'post');
  }

  async selectVideo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) || file.size > 22 * 1024 * 1024) {
      this.errorMessage = 'Chọn video MP4, WebM hoặc MOV không quá 22 MB.';
      return;
    }
    await this.uploadFiles([file], 'video');
  }

  private async uploadFiles(files: File[], type: 'post' | 'video'): Promise<void> {
    this.mediaUploading = true;
    this.errorMessage = '';
    try {
      const urls = await Promise.all(files.map(async file => {
        const data = await this.readFile(file);
        const result = await this.api.uploadImageBase64(data, type);
        if (!result.success || !result.url) throw new Error('Tải tệp lên thất bại.');
        return result.url;
      }));
      if (type === 'video') this.draftVideo = urls[0];
      else this.draftImages = [...this.draftImages, ...urls];
    } catch (error: any) { this.errorMessage = error?.message || 'Không thể tải tệp lên.'; }
    finally { this.mediaUploading = false; this.cdr.markForCheck(); }
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Không đọc được tệp.'));
      reader.onerror = () => reject(new Error('Không đọc được tệp.'));
      reader.readAsDataURL(file);
    });
  }

  removeImage(index: number): void { this.draftImages.splice(index, 1); }

  async submitPost(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.requireLogin() || this.submitting || this.mediaUploading) return;
    if (!this.draftText.trim()) { this.errorMessage = 'Hãy thêm nội dung trước khi đăng.'; return; }
    if (this.composerType === 'reel' && !this.draftVideo) { this.errorMessage = 'Thước phim cần có video.'; return; }
    this.submitting = true;
    this.errorMessage = '';
    const payload = {
      postType: this.composerType,
      text: this.draftText.trim(),
      location: this.draftLocation.trim(),
      hashtags: this.hashtagList,
      images: this.draftImages,
      videoUrl: this.draftVideo,
      itineraryId: this.selectedItineraryId || null,
      tripName: this.selectedItinerary?.name || '',
      challengeId: this.selectedChallengeId || null,
      days: this.selectedItinerary?.days || 0
    };
    if (this.editTarget) {
      const result = await this.api.updateCommunityPost(this.editTarget.id, payload);
      if (!result.success) this.errorMessage = result.message || 'Không cập nhật được bài viết.';
    } else {
      const result = await this.api.createCommunityPost(payload);
      if (!result.success) this.errorMessage = result.message || 'Không đăng được bài viết.';
    }
    this.submitting = false;
    if (!this.errorMessage) { this.composerOpen = false; this.resetComposer(); await this.refreshPage(); }
    this.cdr.markForCheck();
  }

  async likePost(post: CommunityPost): Promise<void> {
    if (!this.requireLogin()) return;
    const previous = post.likes || 0;
    const liked = this.liked.has(post.id);
    const result = liked ? await this.api.unlikePost(post.id) : await this.api.likePost(post.id);
    if (!result.success) return;
    post.likes = result.likes;
    if (liked) this.liked.delete(post.id); else this.liked.add(post.id);
    localStorage.setItem('greensteps_liked_posts', JSON.stringify([...this.liked]));
    if (post.likes < 0) post.likes = previous;
  }

  isLiked(post: CommunityPost): boolean { return this.liked.has(post.id); }

  async toggleSave(post: CommunityPost): Promise<void> {
    if (!this.requireLogin()) return;
    const result = await this.api.toggleSavedCommunityPost(post.id);
    if (result.success) post.isSaved = result.saved;
  }

  async deletePost(post: CommunityPost): Promise<void> {
    if (!this.requireLogin() || post.authorId !== this.userId) return;
    if (!window.confirm('Xóa bài viết này?')) return;
    if (await this.api.deleteCommunityPost(post.id)) this.posts = this.posts.filter(item => item.id !== post.id);
  }

  async sharePost(post: CommunityPost): Promise<void> {
    const url = `${window.location.origin}/community#${encodeURIComponent(post.id)}`;
    const result = await this.api.shareCommunityPost(post.id);
    if (!result.success) { this.errorMessage = 'Không thể ghi nhận lượt chia sẻ.'; return; }
    post.shares = result.shares;
    try {
      if (navigator.share) await navigator.share({ title: post.tripName || 'GreenSteps Travel', text: post.text, url });
      else { await navigator.clipboard.writeText(url); this.errorMessage = 'Đã sao chép liên kết bài viết.'; }
    } catch { /* User dismissed the native share sheet. */ }
  }

  async toggleComments(post: CommunityPost): Promise<void> {
    if (this.commentsOpen.has(post.id)) { this.commentsOpen.delete(post.id); return; }
    this.commentsOpen.add(post.id);
    if (!this.comments[post.id]) await this.loadComments(post.id);
  }

  async loadComments(postId: string): Promise<void> {
    this.commentsLoading.add(postId);
    this.comments[postId] = await this.api.getPostComments(postId);
    this.commentsLoading.delete(postId);
  }

  async submitComment(post: CommunityPost, parentId?: string): Promise<void> {
    if (!this.requireLogin()) return;
    const draftKey = parentId || post.id;
    const text = (parentId ? this.replyDrafts[draftKey] : this.commentDrafts[draftKey])?.trim();
    if (!text) return;
    const result = await this.api.addPostComment(post.id, text, parentId);
    if (!result.success) return;
    if (parentId) this.replyDrafts[draftKey] = ''; else this.commentDrafts[post.id] = '';
    post.comments = (post.comments || 0) + 1;
    await this.loadComments(post.id);
  }

  toggleReply(commentId: string): void { this.replyTo[commentId] = this.replyTo[commentId] ? '' : commentId; }

  async markHelpful(comment: any, postId: string): Promise<void> {
    if (!this.requireLogin()) return;
    const result = await this.api.markCommunityAnswerHelpful(comment.id);
    if (result.success) { comment.helpfulCount = result.helpfulCount; await this.loadComments(postId); }
  }

  async saveItinerary(post: CommunityPost, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.requireLogin() || !post.itinerary_id) return;
    const result = await this.api.cloneItinerary(post.itinerary_id, this.userId);
    if (result?.success) window.location.assign(`/schedule/${encodeURIComponent(result.newItineraryId)}`);
    else this.errorMessage = result?.message || 'Không thể lưu lịch trình.';
  }

  hashtagClick(tag: string): void {
    this.query = `#${tag}`;
    this.changeTab('all');
  }

  getTimeLabel(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return `${Math.floor(hours / 24)} ngày trước`;
  }

  firstLetter(value: string): string { return value?.trim().charAt(0).toUpperCase() || 'G'; }
  avatarIsUrl(value: string): boolean { return !!value && (value.startsWith('http') || value.startsWith('/uploads/')); }
  mediaUrl(value: string | null | undefined): string { return this.api.resolveCommunityMediaUrl(value); }
}
