// ===============================================
// 🚨 [필수] SUPABASE 정보
// ===============================================
const SUPABASE_URL = 'https://tvwbmslgbxccepfbesrg.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2d2Jtc2xnYnhjY2VwZmJlc3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDY2MDYsImV4cCI6MjA4MDMyMjYwNn0.wFidsDlhLB0l3mMV7WmYqY0tqMf3GwGqVhg_bLe11Ds';
// ===============================================

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentContext = 'home';
let currentSortMode = 'latest';

document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.hash.includes('access_token')) {
        window.history.replaceState(null, null, window.location.pathname);
    }
    checkAuth();
    loadDashboard();
});

// ========================================================
// 1. 대시보드 로드 (내 글 보기 추가됨 🔥)
// ========================================================
async function loadDashboard() {
    currentContext = 'home';
    const { data: posts } = await sb.from('posts').select('*, comments(count), post_likes(count)').order('created_at', { ascending: false }).limit(20);
    if(!posts) return;

    renderList('recent-posts', posts.slice(0, 5));
    const popular = [...posts].sort((a,b) => (b.post_likes[0]?.count || 0) - (a.post_likes[0]?.count || 0));
    renderList('popular-posts', popular.slice(0,5));
    const unanswered = posts.filter(p => !p.comments[0] || p.comments[0].count === 0);
    renderList('unanswered-posts', unanswered.slice(0,5));

    // 🔥 [추가됨] 내가 쓴 글 불러오기
    if(currentUser) {
        const { data: myPosts } = await sb.from('posts')
            .select('*, post_likes(count)')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(10); // 최대 10개까지 표시
        
        renderList('my-posts-list', myPosts);
    } else {
        document.getElementById('my-posts-list').innerHTML = '<div style="color:#999; padding:10px;">로그인하면 내가 쓴 글이 여기에 보입니다.</div>';
    }
}

function renderList(elementId, list) {
    const container = document.getElementById(elementId);
    if(!container) return;
    container.innerHTML = '';
    
    if(!list || list.length === 0) {
        container.innerHTML = '<div style="color:#999; font-size:0.9rem; padding:10px;">글이 없습니다.</div>';
        return;
    }

    list.forEach(post => {
        const div = document.createElement('div');
        div.className = 'mini-post-item';
        const likeCount = post.post_likes[0]?.count || 0;
        
        div.innerHTML = `
            <span class="mini-post-title">${post.title}</span>
            <div class="post-meta">
                <span class="mini-post-badge">${post.subject}</span>
                <span class="list-heart">❤️ ${likeCount}</span>
            </div>
        `;
        div.onclick = () => showPostDetail(post.id);
        container.appendChild(div);
    });
}

// ========================================================
// 2. 화면 이동 & 정렬
// ========================================================
function goHome() {
    currentContext = 'home';
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('list-view').classList.add('hidden');
    document.getElementById('detail-view').classList.add('hidden');
    document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.subject-btn').classList.add('active');
    loadDashboard();
}

function goBack() {
    if(currentContext === 'home') goHome();
    else filterSubject(currentContext);
}

function filterSubject(subject, btn) {
    currentContext = subject;
    currentSortMode = 'latest';
    
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('list-view').classList.remove('hidden');
    
    document.querySelectorAll('.subject-btn').forEach(b => {
        b.classList.remove('active');
        if(b.innerText.includes(subject)) b.classList.add('active');
    });

    updateSortButtons('latest');
    document.getElementById('current-subject-title').innerText = subject + ' 게시판';
    fetchAndRenderPosts(subject, 'latest');
}

function sortPosts(mode, btn) {
    currentSortMode = mode;
    updateSortButtons(mode);
    fetchAndRenderPosts(currentContext, mode);
}

function updateSortButtons(mode) {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    const btns = document.querySelectorAll('.sort-btn');
    if(mode === 'latest') btns[0].classList.add('active');
    else if(mode === 'oldest') btns[1].classList.add('active');
    else if(mode === 'popular') btns[2].classList.add('active');
}

async function fetchAndRenderPosts(subject, mode) {
    const container = document.getElementById('posts-container');
    container.innerHTML = '<p style="padding:20px; color:#666;">로딩중...</p>';

    let query = sb.from('posts').select('*, post_likes(count), user_profiles(username)').eq('subject', subject);

    if (mode === 'latest') query = query.order('created_at', { ascending: false });
    else if (mode === 'oldest') query = query.order('created_at', { ascending: true });
    else if (mode === 'popular') query = query.order('created_at', { ascending: false });

    const { data: posts, error } = await query;
    if (error) { container.innerHTML = '<p>에러 발생</p>'; return; }

    let finalPosts = posts;
    if (mode === 'popular') finalPosts = posts.sort((a, b) => (b.post_likes[0].count || 0) - (a.post_likes[0].count || 0));

    renderPostCards(container, finalPosts);
}

function renderPostCards(container, posts) {
    container.innerHTML = '';
    if(!posts || posts.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; margin-top:50px;">글이 없습니다.</p>';
        return;
    }
    posts.forEach(post => {
        const div = document.createElement('div');
        div.className = 'post-card';
        const likeCount = post.post_likes[0]?.count || 0;
        const author = post.user_profiles?.username || '익명';
        div.innerHTML = `
            <h3>${post.title}</h3>
            <div class="post-info">
                <span>👤 ${author}</span>
                <div style="display:flex; gap:10px;">
                    <span>📅 ${new Date(post.created_at).toLocaleDateString()}</span>
                    <span style="color:#C84B31; font-weight:bold;">❤️ ${likeCount}</span>
                </div>
            </div>
        `;
        div.onclick = () => showPostDetail(post.id);
        container.appendChild(div);
    });
}

// ========================================================
// 3. 상세 & 글쓰기 & 인증
// ========================================================
async function showPostDetail(postId) {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('list-view').classList.add('hidden');
    const view = document.getElementById('detail-view');
    view.classList.remove('hidden');

    const { data: post } = await sb.from('posts').select('*, post_likes(count)').eq('id', postId).single();
    const { data: comments } = await sb.from('comments').select('*').eq('post_id', postId).order('created_at');
    
    let authorName = "알 수 없음";
    if(post.user_id) {
        const { data: profile } = await sb.from('user_profiles').select('username').eq('user_id', post.user_id).single();
        if(profile) authorName = profile.username;
    }

    let isLiked = false;
    if(currentUser) {
        const { data } = await sb.from('post_likes').select('*').eq('post_id', postId).eq('user_id', currentUser.id);
        if(data && data.length > 0) isLiked = true;
    }
    
    const likeCount = post.post_likes[0]?.count || 0;
    const heartClass = isLiked ? 'liked' : '';

    view.innerHTML = `
        <button class="btn" style="margin-bottom:1rem; border:1px solid #ddd; background:white;" onclick="goBack()">← 뒤로가기</button>
        <div style="border-bottom:1px solid #eee; padding-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="mini-post-badge">${post.subject}</span>
                <div onclick="toggleLike('${post.id}')" style="cursor:pointer; display:flex; align-items:center;">
                    <span class="heart-icon ${heartClass}">♥</span>
                    <span class="like-count">${likeCount}</span>
                </div>
            </div>
            <h2 style="margin: 0.5rem 0;">${post.title}</h2>
            <div style="color:#666; font-size:0.9rem; display:flex; justify-content:space-between;">
                <span>작성자: <b>${authorName}</b></span>
                <span>${new Date(post.created_at).toLocaleDateString()}</span>
            </div>
        </div>
        ${post.photo_url ? `<img src="${post.photo_url}" style="max-width:100%; border-radius:12px; margin-top:1rem;">` : ''}
        <div style="margin-top:1rem; min-height:100px; white-space:pre-wrap; line-height:1.6;">${post.content}</div>
        
        <div class="comment-box">
            <h4>댓글 (${comments ? comments.length : 0})</h4>
            <div>${comments.map(c => `<div class="comment-item">💬 ${c.content}</div>`).join('')}</div>
            <form class="comment-form" onsubmit="submitComment(event, '${post.id}')">
                <input type="text" id="comment-input" class="comment-input" placeholder="댓글 입력..." required>
                <button type="submit" class="btn btn-signup">등록</button>
            </form>
        </div>
    `;
}

async function toggleLike(postId) {
    if(!currentUser) return alert('로그인 필요');
    const { data: exist } = await sb.from('post_likes').select('*').eq('post_id', postId).eq('user_id', currentUser.id);
    if(exist && exist.length > 0) {
        await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
    } else {
        await sb.from('post_likes').insert({ post_id: postId, user_id: currentUser.id });
    }
    showPostDetail(postId);
}

async function checkAuth() {
    const { data: { user } } = await sb.auth.getUser();
    currentUser = user;
    if(user) {
        document.getElementById('logged-out-btns').classList.add('hidden');
        document.getElementById('logged-in-btns').classList.remove('hidden');
        const { data } = await sb.from('user_profiles').select('username').eq('user_id', user.id).single();
        const nickname = data ? data.username : "회원";
        document.getElementById('user-nickname').innerText = nickname + '님';
    } else {
        document.getElementById('logged-out-btns').classList.remove('hidden');
        document.getElementById('logged-in-btns').classList.add('hidden');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signup-id').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-pw').value;
    const { data: exist } = await sb.from('user_profiles').select('*').eq('username', username);
    if(exist && exist.length > 0) return alert('이미 있는 아이디입니다.');
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username: username } } });
    if(error) return alert(error.message);
    alert('인증 메일을 확인해주세요!'); closeModal();
}

async function handleLogin(e) {
    e.preventDefault();
    const inputId = document.getElementById('login-id').value;
    const password = document.getElementById('login-pw').value;
    const { data: profile } = await sb.from('user_profiles').select('email').eq('username', inputId).single();
    if(!profile) return alert('아이디가 없습니다.');
    const { error } = await sb.auth.signInWithPassword({ email: profile.email, password });
    if(error) alert('로그인 실패');
    else { alert('로그인 성공'); closeModal(); location.reload(); }
}

async function logout() { await sb.auth.signOut(); location.reload(); }

async function submitPost(e) {
    e.preventDefault(); if(!currentUser) return;
    const subject = document.getElementById('post-subject').value;
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    const file = document.getElementById('post-photo').files[0];
    let photoUrl = null;
    if(file) {
        const fileName = `${currentUser.id}_${Date.now()}`;
        const { error } = await sb.storage.from('photos').upload(fileName, file);
        if(!error) { const { data } = sb.storage.from('photos').getPublicUrl(fileName); photoUrl = data.publicUrl; }
    }
    await sb.from('posts').insert({ user_id: currentUser.id, subject, title, content, photo_url: photoUrl });
    alert('등록됨'); closeModal(); goBack();
}

async function submitComment(e, postId) {
    e.preventDefault(); if(!currentUser) return alert('로그인 필요');
    const input = document.getElementById('comment-input');
    await sb.from('comments').insert({ user_id: currentUser.id, post_id: postId, content: input.value });
    showPostDetail(postId);
}

const modalOverlay = document.getElementById('modal-overlay');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const postForm = document.getElementById('post-form');
const modalTitle = document.getElementById('modal-title');
function openModal(type) {
    modalOverlay.style.display = 'block';
    loginForm.classList.add('hidden'); signupForm.classList.add('hidden'); postForm.classList.add('hidden');
    if(type === 'login') { modalTitle.innerText = '로그인'; loginForm.classList.remove('hidden'); loginForm.reset(); }
    else if(type === 'signup') { modalTitle.innerText = '회원가입'; signupForm.classList.remove('hidden'); signupForm.reset(); }
}
function openWriteModal() {
    if(!currentUser) return alert('로그인 필요');
    modalOverlay.style.display = 'block';
    loginForm.classList.add('hidden'); signupForm.classList.add('hidden'); postForm.classList.remove('hidden');
    modalTitle.innerText = '새 글 쓰기'; postForm.reset();
}
function closeModal() { modalOverlay.style.display = 'none'; }