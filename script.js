// ====================================================================
// 1. PENGATURAN MESIN API MASTER
// ====================================================================
const MASTER_API_URL = "https://script.google.com/macros/s/AKfycbzlTycHaa-nE2U2nuAYqV5rXLUJZf3fa5ZTPamTw8GCCSEOZIqDhsPraKNKMyQfv9J_jw/exec"; 

// Variabel untuk mengingat user sedang buka provinsi apa
let KODE_SHARD_AKTIF = ""; 

// 2. FUNGSI SAKTI PEMANGGIL API
async function apiCall(actionName, dataObj = {}) {
    try {
        let response = await fetch(MASTER_API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: actionName, 
                kode_shard: KODE_SHARD_AKTIF,
                data: dataObj 
            })
        });
        
        let result = await response.json();
        if (result.status === "error" || result.success === false) {
            throw new Error(result.message || result.error);
        }
        return result.data !== undefined ? result.data : result;
    } catch (error) {
        console.error("API Error (" + actionName + "):", error);
        throw error;
    }
}

// 3. FUNGSI PINTU MASUK (Dari Portal -> Buka KTA)
function bukaAplikasiKTA(kodeProvinsi) {
    if(!kodeProvinsi) {
        Swal.fire('Error', 'Kode Provinsi tidak ditemukan!', 'error');
        return;
    }

    KODE_SHARD_AKTIF = kodeProvinsi;
    
    // --- BAGIAN UNTUK MENGUBAH URL MENJADI ?id=namaprovinsi ---
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?id=' + kodeProvinsi;
    window.history.pushState({path:newUrl}, '', newUrl);
    // -------------------------------------------------------

    // Transisi UI
    document.getElementById('wrapper-portal').style.display = 'none';
    document.getElementById('wrapper-kta').style.display = 'block';
    
    // Jalankan aplikasi KTA
    jalankanAplikasiKTA();
}

// 4. FUNGSI PINTU KELUAR (Dari KTA -> Kembali ke Portal)
function kembaliKePortal() {
    KODE_SHARD_AKTIF = ""; 
    document.getElementById('wrapper-kta').style.display = 'none';
    document.getElementById('wrapper-portal').style.display = 'block';
    window.scrollTo({top: 0, behavior: 'smooth'});
}

// ==========================================================
// VARIABEL GLOBAL GABUNGAN (APLIKASI 1 & APLIKASI 2)
// ==========================================================

// --- Variabel Aplikasi 1 (Portal Pusat) ---
let appDataCache = {}; let cropper = null; let cropperAdm = null; let quillPrivasi = null; let dashChart = null;
let adminProvPage = 1; const adminProvPerPage = 10; let adminProvSearch = '';
let adminPengurusPage = 1; const adminPengurusPerPage = 10; let adminPengurusSearch = '';
let loadingTimerInterval;

// --- Variabel Aplikasi 2 (KTA Provinsi) ---
var appData = { settings: null, user: null, members: [] };
var adminState = { page: 1, limit: 10, search: "", fUnit: "", fStatus: "", fKab: "", totalData: 0 };
var croppieInstance = null;
var activeCroppie = null; 
var currentDetailMember = null;
var chartInstance = null;
var currentSearchMode = 'nik';
var tableLoaderInterval = null;
// =================================================

function showLoadingAnim(text) {
    let counter = 5;
    Swal.fire({
        title: text + ' (' + counter + ' detik)',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
            const titleElement = Swal.getTitle();
            loadingTimerInterval = setInterval(() => {
                counter--;
                if (counter > 0) {
                    titleElement.textContent = text + ' (' + counter + ' detik)';
                } else {
                    titleElement.textContent = 'Sedang memproses, mohon tunggu...';
                    clearInterval(loadingTimerInterval);
                }
            }, 1000);
        },
        willClose: () => {
            clearInterval(loadingTimerInterval);
        }
    });
}

// Fungsi ini memanggil fungsi lama App 1
async function callGAS(action, payload = {}) {
    return await apiCall(action, payload);
}

function jalankanAplikasi() {
    if(localStorage.getItem('sapaAdminSesi') === 'aktif') {
        switchView('view-admin');
        renderDashboard();
        setTimeout(() => {
            if(!document.querySelector('.ql-toolbar')) {
                quillPrivasi = new Quill('#editor-privasi', { 
                    theme: 'snow', 
                    modules: { 
                        toolbar: [ 
                            [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }], 
                            [{ 'header': [1, 2, 3, 4, 5, 6, false] }], 
                            ['bold', 'italic', 'underline', 'strike'], 
                            [{ 'color': [] }, { 'background': [] }], 
                            [{ 'script': 'sub'}, { 'script': 'super' }], 
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }], 
                            [{ 'indent': '-1'}, { 'indent': '+1' }], 
                            [{ 'align': [] }], 
                            ['blockquote', 'code-block'], 
                            ['link', 'image', 'video'], 
                            ['clean'] 
                        ] 
                    }, 
                    placeholder: 'Ketik Kebijakan Privasi Anda di sini secara lengkap dengan rapi...' 
                }); 
            }
        }, 500);
    } else {
        initPublicView(); 
    }
}

document.addEventListener('DOMContentLoaded', () => { 
    const dataTersimpan = localStorage.getItem('sapaAppDataCache');
    if (dataTersimpan) {
        appDataCache = JSON.parse(dataTersimpan);
        jalankanAplikasi();
        callGAS('getAppData').then(res => {
            if(res.success) {
                appDataCache = res.appData;
                localStorage.setItem('sapaAppDataCache', JSON.stringify(res.appData));
                jalankanAplikasi(); 
            }
        }).catch(e => console.log("Cek update latar belakang gagal, abaikan."));
    } else {
        showLoadingAnim('Memuat Data Sistem');
        callGAS('getAppData').then(res => {
            if(res && (res.success || res.appData)) {
                appDataCache = res.appData || res;
                localStorage.setItem('sapaAppDataCache', JSON.stringify(appDataCache));
                Swal.close();
                jalankanAplikasi();
            }
        }).catch(err => {
            Swal.fire('Error', 'Gagal memuat data dari server.', 'error');
        });
    }
});

function switchView(viewId) { document.getElementById('view-public').classList.add('hidden'); document.getElementById('view-login').classList.add('hidden'); document.getElementById('view-admin').classList.add('hidden'); document.getElementById(viewId).classList.remove('hidden'); if(viewId === 'view-public') initPublicView(); }

function logoutAdminPortal() {
    localStorage.removeItem('sapaAdminSesi');
    switchView('view-public');
    document.getElementById('admin-mobile-menu').value = 'menu-dashboard';
}

function handleMobileAdminMenu(val) { 
    if (val === 'logout') { 
        logoutAdminPortal(); 
    } else { 
        showMenu(val); 
        let type = val.replace('menu-', ''); 
        if (['provinsi', 'pengurus', 'slide', 'hukum'].includes(type)) { renderTablePortal(type); } 
        else if (type === 'petunjuk') { loadPetunjukAdmin(); } 
        else if (type === 'pengaturan') { loadPengaturanAdmin(); } 
    } 
}

function togglePassword() { const pwd = document.getElementById('password'); const icon = document.getElementById('eye-icon'); if (pwd.type === 'password') { pwd.type = 'text'; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); } else { pwd.type = 'password'; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); } }

function showAdminPusatModal() {
    const info = appDataCache.infoUmum || {}; const modal = document.getElementById('modal-global-portal'); modal.classList.remove('hidden'); modal.classList.add('flex'); document.getElementById('modal-title-portal').innerText = "Hubungi Admin Pusat"; 
    const headerActions = document.getElementById('modal-header-actions-portal'); headerActions.innerHTML = '<button onclick="closeModalPortal(); switchView(\'view-login\');" class="text-navy bg-gold px-3 py-1 rounded text-sm font-bold hover:bg-yellow-400 transition cursor-pointer shadow"><i class="fa-solid fa-lock"></i> Admin</button>';
    let cleanWa = String(info.admin_hp || '').replace(/[^0-9]/g, ''); if(cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1); let waUrl = cleanWa ? 'https://wa.me/' + cleanWa : '#';
    document.getElementById('modal-body-portal').innerHTML = '<div class="flex flex-col items-center text-center p-4"><img src="'+(info.admin_foto || 'https://via.placeholder.com/300x400')+'" alt="Admin Pusat" class="w-32 h-40 object-cover rounded-lg shadow-md border-2 border-gold mb-4"><h3 class="text-2xl font-bold text-navy">'+(info.admin_nama || 'Belum ada data')+'</h3><p class="text-gray-500 font-semibold mb-6">'+(info.admin_jabatan || '-')+'</p><div class="w-full space-y-3"><a href="'+waUrl+'" target="_blank" class="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg shadow transition"><i class="fa-brands fa-whatsapp text-xl"></i> Chat WhatsApp</a><a href="mailto:'+(info.admin_email || '')+'" class="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition"><i class="fa-solid fa-envelope text-xl"></i> Kirim Email</a><button onclick="closeModalPortal()" class="w-full mt-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-lg shadow transition">Tutup</button></div></div>';
}

function showPrivasiModal() {
    const info = appDataCache.infoUmum || {}; const modal = document.getElementById('modal-global-portal'); modal.classList.remove('hidden'); modal.classList.add('flex'); document.getElementById('modal-title-portal').innerText = "⚖️ Kebijakan Privasi (Privacy Policy)"; document.getElementById('modal-header-actions-portal').innerHTML = '<button onclick="closeModalPortal()" class="text-red-500 font-bold text-xl cursor-pointer">X</button>';
    const privasiKonten = info.kebijakan_privasi || '<p class="text-center text-gray-500 mt-10 mb-10">Dokumen Kebijakan Privasi belum ditambahkan oleh Admin.</p>';
    document.getElementById('modal-body-portal').innerHTML = '<div class="modal-prose text-gray-700 px-2 py-4">' + privasiKonten + '</div><div class="mt-8 text-right border-t pt-4"><button onclick="closeModalPortal()" class="w-full sm:w-auto bg-navy hover:bg-gray-800 text-white font-bold py-2 px-6 rounded shadow transition">Saya Mengerti</button></div>';
}

function initPublicView() {
    try {
        if (!appDataCache || Object.keys(appDataCache).length === 0) return; const info = appDataCache.infoUmum || {}; const kontak = appDataCache.kontak || {};
        document.getElementById('teks-pengumuman').innerText = info.pengumuman || 'Selamat datang di SAPA KTA. Silakan lakukan pendaftaran anggota...'; document.getElementById('logo').src = info.logo_url || ''; document.getElementById('nav-title').innerText = info.nama_aplikasi || 'SAPA KTA'; document.getElementById('hero-title').innerText = info.nama_organisasi || 'Selamat Datang'; document.getElementById('hero-subtitle').innerText = info.nama_panjang || '';
        const heroLogo = document.getElementById('hero-logo'); if(info.logo_url) { heroLogo.src = info.logo_url; heroLogo.classList.remove('hidden'); } else { heroLogo.classList.add('hidden'); }

        const ftLogo = document.getElementById('ft-logo'); if(info.logo_url) { ftLogo.src = info.logo_url; ftLogo.classList.remove('hidden'); }
        document.getElementById('ft-app').innerText = info.nama_aplikasi || 'SAPA KTA'; document.getElementById('ft-org').innerText = info.nama_organisasi || 'Nama Organisasi'; document.getElementById('ft-sk').innerText = info.sk_kemenkumham ? 'SK Kemenkumham: ' + info.sk_kemenkumham : ''; document.getElementById('ft-alamat').innerHTML = kontak.alamat ? '<i class="fa-solid fa-map-location-dot mr-1 text-gold"></i> ' + kontak.alamat : '-';
        
        let emailLink = kontak.email ? '<li><a href="mailto:'+kontak.email+'" class="hover:text-gold flex items-center gap-3 transition"><i class="fa-solid fa-envelope text-xl text-gray-300"></i> '+kontak.email+'</a></li>' : '';
        let waNum = String(kontak.telepon || kontak.whatsapp || '').replace(/[^0-9]/g, ''); if(waNum.startsWith('0')) waNum = '62' + waNum.substring(1);
        let waLink = waNum ? '<li><a href="https://wa.me/'+waNum+'" target="_blank" class="hover:text-gold flex items-center gap-3 transition"><i class="fa-brands fa-whatsapp text-green-500 text-xl"></i> '+(kontak.telepon || kontak.whatsapp)+'</a></li>' : '';
        let webLink = kontak.website ? '<li><a href="'+(kontak.website.startsWith('http') ? kontak.website : 'https://'+kontak.website)+'" target="_blank" class="hover:text-gold flex items-center gap-3 transition"><i class="fa-solid fa-globe text-blue-400 text-xl"></i> '+kontak.website+'</a></li>' : '';
        document.getElementById('ft-kontak-list').innerHTML = emailLink + waLink + webLink || '<li class="text-gray-500">Belum ada kontak</li>';

        const sList = document.getElementById('sosmed-list'); sList.innerHTML = '';
        const buildSosmed = (val, icon, color) => { if(!val) return ''; let link = val.startsWith('http') ? val : 'https://' + val; let label = val.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]; return '<li><a href="'+link+'" target="_blank" class="hover:text-gold flex items-center gap-3 font-semibold transition"><i class="fa-brands '+icon+' '+color+' text-xl w-5 text-center"></i> '+label+'</a></li>'; };
        sList.innerHTML += buildSosmed(kontak.ig, 'fa-instagram', 'text-pink-500') + buildSosmed(kontak.fb, 'fa-facebook', 'text-blue-500') + buildSosmed(kontak.x, 'fa-x-twitter', 'text-gray-300') + buildSosmed(kontak.yt, 'fa-youtube', 'text-red-500') + buildSosmed(kontak.tg, 'fa-telegram', 'text-blue-400') + buildSosmed(kontak.tt, 'fa-tiktok', 'text-gray-300');
        if(sList.innerHTML === '') sList.innerHTML = '<li class="text-gray-600 font-mono">Belum ada akun terhubung</li>';

        const heroSection = document.getElementById('beranda'); let sliderImages = appDataCache.slide ? appDataCache.slide.map(s => s.gambar_url).filter(url => url) : []; if(sliderImages.length === 0) sliderImages = ['https://images.unsplash.com/photo-1577563908411-5077b6dc7624?q=80&w=2070'];
        heroSection.style.backgroundImage = 'url("'+sliderImages[0]+'")'; heroSection.classList.add('animate-bg-slide');
        if(window.heroInterval) clearInterval(window.heroInterval); if(sliderImages.length > 1) { let currentSlide = 0; window.heroInterval = setInterval(() => { currentSlide = (currentSlide + 1) % sliderImages.length; heroSection.classList.remove('animate-bg-slide'); void heroSection.offsetWidth; heroSection.classList.add('animate-bg-slide'); heroSection.style.backgroundImage = 'url("'+sliderImages[currentSlide]+'")'; }, 5000); }

        const pengurusContainer = document.getElementById('pengurus-container'); if (pengurusContainer) pengurusContainer.innerHTML = '';
        if(appDataCache.pengurus && appDataCache.pengurus.length > 0) { 
            appDataCache.pengurus.forEach(p => { 
                pengurusContainer.innerHTML += '<div class="relative rounded-2xl shadow-lg overflow-hidden flex-shrink-0 snap-center w-[calc(50%-0.5rem)] md:w-[calc(25%-0.75rem)] group cursor-pointer border-2 border-transparent hover:border-gold transition-all duration-300"><div class="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-transparent opacity-90 z-10"></div><img src="'+(p.foto_url || 'https://via.placeholder.com/300x400')+'" alt="'+(p.nama || '')+'" class="w-full foto-pengurus transform transition-transform duration-700 group-hover:scale-110 object-cover"><div class="absolute bottom-0 left-0 w-full p-4 z-20 text-center transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300"><h4 class="font-extrabold text-sm md:text-base text-gold drop-shadow-md">'+(p.nama || '')+'</h4><p class="text-[10px] md:text-xs text-white font-medium tracking-wide mt-1">'+(p.jabatan || '')+'</p><div class="w-0 h-0.5 bg-gold mx-auto mt-2 transition-all duration-500 group-hover:w-1/2"></div></div></div>'; 
            });
            document.getElementById('pengurus-section').classList.remove('hidden'); 
            if(window.pengurusInterval) clearInterval(window.pengurusInterval);
            window.pengurusInterval = setInterval(() => { const pContainer = document.getElementById('pengurus-container'); if(!pContainer) return; const maxScroll = pContainer.scrollWidth - pContainer.clientWidth; if(pContainer.scrollLeft >= maxScroll - 10) { pContainer.scrollTo({ left: 0, behavior: 'smooth' }); } else { pContainer.scrollBy({ left: pContainer.clientWidth, behavior: 'smooth' }); } }, 4000);
        } else { document.getElementById('pengurus-section').classList.add('hidden'); }

        document.getElementById('petunjuk-text').innerText = info.petunjuk_narasi || ''; const ytWrapper = document.getElementById('yt-wrapper');
        if(info.petunjuk_youtube) { let ytUrl = String(info.petunjuk_youtube); let videoId = ytUrl.split('v=')[1] || ytUrl.split('/').pop(); if(videoId && videoId.indexOf('&') !== -1) videoId = videoId.substring(0, videoId.indexOf('&')); if(videoId) { ytWrapper.innerHTML = '<iframe src="https://www.youtube.com/embed/'+videoId+'" frameborder="0" allowfullscreen></iframe>'; ytWrapper.classList.remove('hidden'); } } else { ytWrapper.classList.add('hidden'); }
        const btnPdf = document.getElementById('btn-pdf-petunjuk'); if(info.petunjuk_pdf) { btnPdf.href = info.petunjuk_pdf; btnPdf.classList.remove('hidden'); } else { btnPdf.classList.add('hidden'); }

        const hukumContainer = document.getElementById('hukum-container'); if (hukumContainer) hukumContainer.innerHTML = '';
        if(appDataCache.dasarHukum) { appDataCache.dasarHukum.forEach(item => { let linkHTML = item.file_url ? '<a href="'+item.file_url+'" target="_blank" class="text-green-600 font-bold text-sm mt-2 inline-block"><i class="fa-solid fa-eye"></i> Lihat Dokumen</a>' : ''; hukumContainer.innerHTML += '<div class="bg-white p-4 rounded shadow-sm border-l-4 border-gold border border-gray-200"><h4 class="font-bold text-navy">'+(item.nomor || '')+'</h4><p class="text-gray-600 text-sm">'+(item.tentang || '')+'</p>'+linkHTML+'</div>'; }); }

        const provContainer = document.getElementById('provinsi-container'); if (provContainer) provContainer.innerHTML = ''; let tDaftar = 0, tKTA = 0, tAktif = 0, tTidakAktif = 0;
        if(appDataCache.provinsi) { 

appDataCache.provinsi.forEach(prov => { 
    tDaftar += parseInt(prov.jumlah_daftar) || 0; 
    tKTA += parseInt(prov.jumlah_kta) || 0; 
    tAktif += parseInt(prov.jumlah_aktif) || 0; 
    tTidakAktif += parseInt(prov.jumlah_tidak_aktif) || 0; 
    
    let cleanWa = String(prov.hp_admin || '').replace(/[^0-9]/g, ''); 
    if(cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1); 
    let waUrl = cleanWa ? 'https://wa.me/' + cleanWa : '#'; 
    let safeNamaProvinsi = String(prov.nama_provinsi || ''); 
    
    // AMBIL KODE SHARD DARI DATABASE (Misal: 13jawabarat)
    let kShard = prov.kode_shard || ''; 

    provContainer.innerHTML += `
        <div class="prov-card bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden card-hover flex flex-col snap-center shrink-0 w-full min-w-full md:w-[calc(33.333%-1rem)] md:min-w-[calc(33.333%-1rem)] min-h-[250px] box-border" data-nama="${safeNamaProvinsi.toLowerCase()}">
            <div class="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 p-3">
                <h3 class="font-bold text-white text-center truncate">${safeNamaProvinsi}</h3>
            </div>
            <div class="p-5 flex-grow flex flex-col justify-between space-y-4">
                <div class="text-sm space-y-3">
                    <div>
                        <p class="text-xs text-gray-500 font-bold mb-1">Helpdesk Admin Prov. :</p>
                        <p class="font-semibold text-gray-800 flex items-center">👤 ${prov.nama_admin || '-'}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 font-bold mb-1">Kontak (HP/WA) :</p>
                        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="font-semibold text-green-600 flex items-center hover:text-green-700">
                            <i class="fa-brands fa-whatsapp text-green-500 text-xl mr-2"></i> ${prov.hp_admin || '-'}
                        </a>
                    </div>
                </div>
                <button onclick="bukaAplikasiKTA('${kShard}')" class="block w-full text-center bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-white font-bold py-2 rounded shadow-md hover:opacity-90 transition text-sm">
                    Daftar & Login Anggota
                </button>
            </div>
        </div>`;
});
        }

        document.getElementById('stat-daftar').innerText = tDaftar.toLocaleString('id-ID'); document.getElementById('stat-kta').innerText = tKTA.toLocaleString('id-ID'); document.getElementById('stat-aktif').innerText = tAktif.toLocaleString('id-ID'); document.getElementById('stat-tidak-aktif').innerText = tTidakAktif.toLocaleString('id-ID');
    } catch (err) { Swal.fire('Error', 'Ada Error Data: ' + err.message, 'error'); }
}

function slideProvinsi(direction) { 
    const container = document.getElementById('provinsi-container'); 
    const scrollAmount = window.innerWidth < 768 ? container.clientWidth : (container.clientWidth / 3); 
    container.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' }); 
}

function filterProvinsi() { 
    const input = document.getElementById('searchInput').value.toLowerCase(); 
    document.querySelectorAll('.prov-card').forEach(card => { 
        if(card.getAttribute('data-nama').includes(input)) { card.style.display = ''; } else { card.style.display = 'none'; } 
    }); 
}

async function handleLoginPortal(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-login-portal'); 
    btn.innerText = "Memeriksa..."; 
    showLoadingAnim('Memeriksa Kredensial Admin');
    
    try {
        const res = await callGAS('verifyLogin', {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        });
        
        btn.innerText = "Masuk"; 
        if(res && res.success){ 
            localStorage.setItem('sapaAdminSesi', 'aktif');
            switchView('view-admin'); 
            renderDashboard(); 
            
            if(!document.querySelector('.ql-toolbar')) {
                quillPrivasi = new Quill('#editor-privasi', { 
                    theme: 'snow', 
                    modules: { 
                        toolbar: [ 
                            [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }], 
                            [{ 'header': [1, 2, 3, 4, 5, 6, false] }], 
                            ['bold', 'italic', 'underline', 'strike'], 
                            [{ 'color': [] }, { 'background': [] }], 
                            [{ 'script': 'sub'}, { 'script': 'super' }], 
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }], 
                            [{ 'indent': '-1'}, { 'indent': '+1' }], 
                            [{ 'align': [] }], 
                            ['blockquote', 'code-block'], 
                            ['link', 'image', 'video'], 
                            ['clean'] 
                        ] 
                    }, 
                    placeholder: 'Ketik Kebijakan Privasi Anda di sini secara lengkap dengan rapi...' 
                }); 
            }
            Swal.fire({toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Login Berhasil'}); 
        } else { 
            Swal.fire('Gagal Login', res.message || 'Error', 'error'); 
        }
    } catch (err) {
        btn.innerText = "Masuk";
        Swal.fire('Error', err.message, 'error');
    }
}

function renderDashboard() {
    if (!appDataCache || !appDataCache.provinsi) return;
    
    let tProv = appDataCache.provinsi.length;
    let tDaftar = 0, tKTA = 0, tAktif = 0, tTidakAktif = 0;
    
    appDataCache.provinsi.forEach(prov => {
        tDaftar += parseInt(prov.jumlah_daftar) || 0;
        tKTA += parseInt(prov.jumlah_kta) || 0;
        tAktif += parseInt(prov.jumlah_aktif) || 0;
        tTidakAktif += parseInt(prov.jumlah_tidak_aktif) || 0;
    });

    document.getElementById('dash-prov').innerText = tProv.toLocaleString('id-ID');
    document.getElementById('dash-daftar').innerText = tDaftar.toLocaleString('id-ID');
    document.getElementById('dash-kta').innerText = tKTA.toLocaleString('id-ID');
    document.getElementById('dash-aktif').innerText = tAktif.toLocaleString('id-ID');
    document.getElementById('dash-nonaktif').innerText = tTidakAktif.toLocaleString('id-ID');

    const ctx = document.getElementById('dashboardChart');
    if (!ctx) return; 
    const context2d = ctx.getContext('2d');
    
    if (dashChart) dashChart.destroy(); 
    
    if (typeof Chart !== 'undefined') {
        dashChart = new Chart(context2d, {
            type: 'bar', 
            data: {
                labels: ['Mendaftar', 'Punya KTA', 'Aktif', 'Tidak Aktif'],
                datasets: [{
                    label: 'Jumlah Anggota',
                    data: [tDaftar, tKTA, tAktif, tTidakAktif],
                    backgroundColor: ['rgba(234, 179, 8, 0.8)', 'rgba(99, 102, 241, 0.8)', 'rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)'],
                    borderColor: ['rgb(202, 138, 4)', 'rgb(79, 70, 229)', 'rgb(22, 163, 74)', 'rgb(220, 38, 38)'],
                    borderWidth: 1, borderRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { borderDash: [5, 5] } } } }
        });
    }
}

function showMenu(id) { 
    document.querySelectorAll('.menu-content').forEach(el => el.classList.add('hidden')); 
    document.getElementById(id).classList.remove('hidden'); 
    if (id === 'menu-dashboard') { renderDashboard(); }
}

function refreshAdminData(renderType) { 
    callGAS('getAppData').then(res => {
        if(res.success) {
            appDataCache = res.appData; 
            localStorage.setItem('sapaAppDataCache', JSON.stringify(res.appData));
            if(renderType) renderTablePortal(renderType); 
        }
    });
}

function filterAdminProv() { adminProvSearch = document.getElementById('adminSearchProv').value.toLowerCase(); adminProvPage = 1; renderTablePortal('provinsi'); }
function changeProvPage(page) { adminProvPage = page; renderTablePortal('provinsi'); }
function filterAdminPengurus() { adminPengurusSearch = document.getElementById('adminSearchPengurus').value.toLowerCase(); adminPengurusPage = 1; renderTablePortal('pengurus'); }
function changePengurusPage(page) { adminPengurusPage = page; renderTablePortal('pengurus'); }

function renderTablePortal(type) {
    try {
        const tbody = document.getElementById('table-'+type); tbody.innerHTML = ''; 
        let data = (type === 'hukum') ? appDataCache.dasarHukum : appDataCache[type];
        if(!data) data = [];

        if (type === 'provinsi') {
            if (adminProvSearch) data = data.filter(item => String(item.nama_provinsi).toLowerCase().includes(adminProvSearch));
            const totalPages = Math.ceil(data.length / adminProvPerPage); const start = (adminProvPage - 1) * adminProvPerPage;
            const pageContainer = document.getElementById('pagination-provinsi'); pageContainer.innerHTML = '';
            if (totalPages > 1) { pageContainer.classList.remove('hidden'); for (let i = 1; i <= totalPages; i++) { const btnClass = (i === adminProvPage) ? "bg-navy text-white px-3 py-1 rounded" : "bg-gray-200 text-gray-800 px-3 py-1 rounded hover:bg-gray-300"; pageContainer.innerHTML += '<button onclick="changeProvPage('+i+')" class="'+btnClass+'">'+i+'</button>'; } } else { pageContainer.classList.add('hidden'); }
            data = data.slice(start, start + adminProvPerPage);
        }

        if (type === 'pengurus') {
            if (adminPengurusSearch) data = data.filter(item => String(item.nama).toLowerCase().includes(adminPengurusSearch) || String(item.jabatan).toLowerCase().includes(adminPengurusSearch));
            const totalPages = Math.ceil(data.length / adminPengurusPerPage); const start = (adminPengurusPage - 1) * adminPengurusPerPage;
            const pageContainer = document.getElementById('pagination-pengurus'); pageContainer.innerHTML = '';
            if (totalPages > 1) { pageContainer.classList.remove('hidden'); for (let i = 1; i <= totalPages; i++) { const btnClass = (i === adminPengurusPage) ? "bg-navy text-white px-3 py-1 rounded" : "bg-gray-200 text-gray-800 px-3 py-1 rounded hover:bg-gray-300"; pageContainer.innerHTML += '<button onclick="changePengurusPage('+i+')" class="'+btnClass+'">'+i+'</button>'; } } else { pageContainer.classList.add('hidden'); }
            data = data.slice(start, start + adminPengurusPerPage);
        }

        if(data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Data tidak ditemukan.</td></tr>'; return; }
        
        data.forEach(item => {
            let html = '';
            // PERHATIKAN: Saya sudah menambahkan tanda kutip aman (\') di sekitar item.id
            if(type === 'provinsi') { 
                html = '<tr class="border-b hover:bg-gray-50"><td class="p-4 font-bold">'+item.nama_provinsi+'<br><span class="text-xs font-normal text-gray-500">Admin: '+item.nama_admin+'</span></td><td class="p-4 text-xs">Daftar: '+(item.jumlah_daftar||0)+' | Aktif: '+(item.jumlah_aktif||0)+'</td><td class="p-4 text-right whitespace-nowrap"><button onclick="openFormPortal(\'provinsi\', \''+item.id+'\')" class="text-blue-600 mr-2 font-bold">Edit</button><button onclick="delData(\'Provinsi\', \''+item.id+'\')" class="text-red-600 font-bold">Hapus</button></td></tr>'; 
            } 
            else if(type === 'slide') { 
                html = '<tr class="border-b hover:bg-gray-50"><td class="p-4 font-bold">'+item.nama_gambar+'</td><td class="p-4"><img src="'+item.gambar_url+'" class="h-10 rounded"></td><td class="p-4 text-right whitespace-nowrap"><button onclick="delData(\'Slide\', \''+item.id+'\')" class="text-red-600 font-bold">Hapus</button></td></tr>'; 
            } 
            else if(type === 'hukum') { 
                let viewBtn = item.file_url ? '<a href="'+item.file_url+'" target="_blank" class="text-green-600 mr-4 font-bold hover:text-green-800"><i class="fa-solid fa-eye"></i> Lihat</a>' : ''; 
                html = '<tr class="border-b hover:bg-gray-50"><td class="p-4 font-bold">'+item.nomor+'</td><td class="p-4 text-sm">'+item.tentang+'</td><td class="p-4 text-right whitespace-nowrap">'+viewBtn+'<button onclick="openFormPortal(\'hukum\', \''+item.id+'\')" class="text-blue-600 mr-2 font-bold">Edit</button><button onclick="delData(\'DasarHukum\', \''+item.id+'\')" class="text-red-600 font-bold">Hapus</button></td></tr>'; 
            }
            else if(type === 'pengurus') { 
                html = '<tr class="border-b hover:bg-gray-50"><td class="p-4"><img src="'+item.foto_url+'" class="h-12 w-9 object-cover rounded"></td><td class="p-4 font-bold">'+item.nama+'<br><span class="text-xs font-normal text-gray-500">'+item.jabatan+'</span></td><td class="p-4 text-right whitespace-nowrap"><button onclick="openFormPortal(\'pengurus\', \''+item.id+'\')" class="text-blue-600 mr-2 font-bold">Edit</button><button onclick="delData(\'Pengurus\', \''+item.id+'\')" class="text-red-600 font-bold">Hapus</button></td></tr>'; 
            }
            tbody.innerHTML += html;
        });
    } catch (err) { Swal.fire('Error', 'Error Render Table: ' + err.message, 'error'); }
}

function openFormPortal(type, id = null) {
    const modal = document.getElementById('modal-global-portal'); modal.classList.remove('hidden'); modal.classList.add('flex');
    const title = document.getElementById('modal-title-portal'); const body = document.getElementById('modal-body-portal');
    const headerActions = document.getElementById('modal-header-actions-portal'); headerActions.innerHTML = '<button onclick="closeModalPortal()" class="text-red-500 font-bold text-2xl cursor-pointer">X</button>';
    let item = id ? (type === 'hukum' ? appDataCache.dasarHukum.find(x => x.id == id) : appDataCache[type].find(x => x.id == id)) : {};
    
    if(type === 'provinsi') { 
        title.innerText = id ? "Edit Anggota Provinsi" : "Tambah Anggota Provinsi"; 
        body.innerHTML = `
        <form onsubmit="saveProvinsi(event)">
            <input type="hidden" id="p-id" value="${item.id||''}">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div><label class="text-xs font-bold">Nama Provinsi</label><input type="text" id="p-nama" value="${item.nama_provinsi||''}" class="w-full border p-2 rounded" required></div>
                <div><label class="text-xs font-bold">Kode Shard (App 2)</label><input type="text" id="p-link" value="${item.link_pendaftaran||''}" class="w-full border p-2 rounded" placeholder="misal: 13jawabarat" required></div>
                <div><label class="text-xs font-bold">Nama Admin Prov</label><input type="text" id="p-admin" value="${item.nama_admin||''}" class="w-full border p-2 rounded" required></div>
                <div><label class="text-xs font-bold">Telepon Admin Prov</label><input type="text" id="p-hp" value="${item.hp_admin||''}" class="w-full border p-2 rounded" required></div>
                <div class="sm:col-span-2"><label class="text-xs font-bold">WA Admin Prov (Awali dengan 62)</label><input type="text" id="p-wa" value="${item.wa_admin || item.hp_admin || ''}" class="w-full border p-2 rounded" required></div>
                <div><label class="text-xs font-bold">Daftar</label><input type="number" id="p-df" value="${item.jumlah_daftar||0}" class="w-full border p-2 rounded"></div>
                <div><label class="text-xs font-bold">Aktif</label><input type="number" id="p-ak" value="${item.jumlah_aktif||0}" class="w-full border p-2 rounded"></div>
            </div>
            <button class="w-full sm:w-auto bg-navy text-white px-4 py-2 rounded font-bold">Simpan Provinsi</button>
        </form>`; 
    } 
    else if (type === 'slide') { title.innerText = "Tambah Slide (Crop 7:4)"; body.innerHTML = '<form onsubmit="execSaveSlide(event)"><label class="text-sm font-bold">Nama Gambar</label><input type="text" id="s-nama" class="w-full border p-2 mb-2 rounded" required><label class="text-sm font-bold">Pilih File</label><input type="file" id="s-file" accept="image/*" class="w-full border p-2 mb-2 rounded" onchange="initCropper(event, 7/4)" required><div class="w-full max-h-64 overflow-hidden bg-gray-200 mb-2 rounded"><img id="cropper-img" class="max-w-full hidden"></div><button type="submit" id="btn-s-save" class="w-full sm:w-auto bg-navy text-white px-4 py-2 rounded font-bold">Crop & Upload</button></form>'; }
    else if (type === 'pengurus') { title.innerText = id ? "Edit Pengurus (Crop 3:4)" : "Tambah Pengurus (Crop 3:4)"; body.innerHTML = '<form onsubmit="execSavePengurus(event)"><input type="hidden" id="pe-id" value="'+(item.id||'')+'"><input type="hidden" id="pe-url-lama" value="'+(item.foto_url||'')+'"><label class="text-sm font-bold">Nama</label><input type="text" id="pe-nama" value="'+(item.nama||'')+'" class="w-full border p-2 mb-2 rounded" required><label class="text-sm font-bold">Jabatan</label><input type="text" id="pe-jabatan" value="'+(item.jabatan||'')+'" class="w-full border p-2 mb-2 rounded" required><label class="text-sm font-bold">Upload Foto Baru (Opsional)</label><input type="file" accept="image/*" class="w-full border p-2 mb-2 rounded" onchange="initCropper(event, 3/4)"><div class="w-full max-h-64 overflow-hidden bg-gray-200 mb-2 rounded"><img id="cropper-img" class="max-w-full hidden"></div><button type="submit" id="btn-pe-save" class="w-full sm:w-auto bg-navy text-white px-4 py-2 rounded font-bold">Simpan Data</button></form>'; }
    else if (type === 'hukum') { title.innerText = id ? "Edit Dasar Hukum" : "Tambah Dasar Hukum"; body.innerHTML = '<form onsubmit="execSaveHukum(event)"><input type="hidden" id="h-id" value="'+(item.id||'')+'"><input type="hidden" id="h-url-lama" value="'+(item.file_url||'')+'"><label class="text-sm font-bold">Nomor Hukum</label><input type="text" id="h-nomor" value="'+(item.nomor||'')+'" class="w-full border p-2 mb-2 rounded" required><label class="text-sm font-bold">Tentang</label><input type="text" id="h-tentang" value="'+(item.tentang||'')+'" class="w-full border p-2 mb-2 rounded" required><label class="text-sm font-bold">Upload PDF (Opsional)</label><input type="file" id="h-file" accept=".pdf" class="w-full border p-2 mb-2 rounded"><button type="submit" id="btn-h-save" class="w-full sm:w-auto bg-navy text-white px-4 py-2 rounded font-bold">Simpan</button></form>'; }
}

function closeModalPortal() { document.getElementById('modal-global-portal').classList.add('hidden'); document.getElementById('modal-global-portal').classList.remove('flex'); if(cropper) { cropper.destroy(); cropper = null; } }
function initCropper(e, rasio) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { const img = document.getElementById('cropper-img'); img.src = evt.target.result; img.classList.remove('hidden'); if(cropper) cropper.destroy(); cropper = new Cropper(img, { aspectRatio: rasio, viewMode: 1, autoCropArea: 1 }); }; reader.readAsDataURL(file); }
function initCropperAdm(e, rasio) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { const img = document.getElementById('cropper-img-adm'); img.src = evt.target.result; img.classList.remove('hidden'); if(cropperAdm) cropperAdm.destroy(); cropperAdm = new Cropper(img, { aspectRatio: rasio, viewMode: 1, autoCropArea: 1 }); }; reader.readAsDataURL(file); }

async function saveProvinsi(e) { 
    e.preventDefault(); 
    const data = { 
        id: document.getElementById('p-id').value, 
        nama_provinsi: document.getElementById('p-nama').value, 
        link_pendaftaran: document.getElementById('p-link').value, 
        nama_admin: document.getElementById('p-admin').value, 
        hp_admin: document.getElementById('p-hp').value, 
        wa_admin: document.getElementById('p-wa').value, // Menangkap WA
        jumlah_daftar: document.getElementById('p-df').value, 
        jumlah_aktif: document.getElementById('p-ak').value 
    }; 
    try {
        showLoadingAnim('Menyimpan Data Provinsi');
        await callGAS('saveProvinsi', data);
        closeModalPortal(); 
        refreshAdminData('provinsi'); 
        Swal.fire({toast:true, position:'top-end', showConfirmButton:false, timer:3000, icon:'success', title:'Data Tersimpan'});
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
}

async function execSaveSlide(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-s-save'); 
    if(!cropper) return Swal.fire('Peringatan', 'Pilih gambar terlebih dahulu!', 'warning'); 
    btn.disabled = true; 
    showLoadingAnim('Mengunggah Slide');
    const base64Data = cropper.getCroppedCanvas({width: 1400, height: 800}).toDataURL('image/jpeg', 0.8); 
    const nama = document.getElementById('s-nama').value; 
    
    try {
        const res = await callGAS('prosesSimpanSlide', { data: {id: null, nama_gambar: nama}, base64Data: base64Data });
        if(res && res.success){ 
            appDataCache.slide = res.updatedList; 
            renderTablePortal('slide'); 
            closeModalPortal(); 
            Swal.fire('Berhasil', 'Slide Tersimpan', 'success'); 
        } else { 
            Swal.fire('Gagal', res?res.error:'Error', 'error'); 
            btn.disabled = false; 
        }
    } catch(err) {
        Swal.fire('Error', err.message, 'error'); 
        btn.disabled = false; 
    }
}

async function execSavePengurus(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-pe-save'); 
    const data = { id: document.getElementById('pe-id').value, nama: document.getElementById('pe-nama').value, jabatan: document.getElementById('pe-jabatan').value, foto_url: document.getElementById('pe-url-lama').value }; 
    btn.disabled = true; 
    showLoadingAnim('Menyimpan Data Pengurus');
    let base64Data = null; 
    if (cropper) { base64Data = cropper.getCroppedCanvas({width: 600, height: 800}).toDataURL('image/jpeg', 0.8); } 
    
    try {
        const res = await callGAS('prosesSimpanPengurus', { data: data, base64Data: base64Data });
        if(res && res.success) { 
            appDataCache.pengurus = res.updatedList; 
            renderTablePortal('pengurus'); 
            closeModalPortal(); 
            Swal.fire('Berhasil', 'Pengurus Tersimpan', 'success'); 
        } else { 
            Swal.fire('Gagal', res?res.error:'Error', 'error'); 
            btn.disabled = false; 
        }
    } catch(err) {
        Swal.fire('Error', err.message, 'error'); 
        btn.disabled = false;
    }
}

async function execSaveHukum(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-h-save'); 
    const fileInput = document.getElementById('h-file'); 
    const data = { id: document.getElementById('h-id').value, nomor: document.getElementById('h-nomor').value, tentang: document.getElementById('h-tentang').value, file_url: document.getElementById('h-url-lama').value }; 
    btn.disabled = true; 
    showLoadingAnim('Menyimpan Dasar Hukum');
    
    try {
        if (fileInput.files.length > 0) { 
            const base64 = await getBase64(fileInput.files[0]); 
            const resUpload = await callGAS('uploadFileToDrive', { base64Data: base64, fileName: fileInput.files[0].name });
            if(resUpload && resUpload.success) { 
                data.file_url = resUpload.url; 
                await callGAS('saveDasarHukum', data);
                closeModalPortal(); 
                refreshAdminData('hukum'); 
                Swal.fire('Berhasil', 'Data Tersimpan', 'success');
            } else { 
                Swal.fire('Gagal', resUpload?resUpload.error:'Error', 'error'); 
                btn.disabled = false; 
            } 
        } else { 
            await callGAS('saveDasarHukum', data);
            closeModalPortal(); 
            refreshAdminData('hukum'); 
            Swal.fire('Berhasil', 'Data Tersimpan', 'success');
        }
    } catch(err) {
        Swal.fire('Error', err.message, 'error'); 
        btn.disabled = false;
    }
}

function delData(funcName, id) { 
    Swal.fire({ title: 'Yakin hapus data ini?', text: "Tindakan ini tidak dapat dibatalkan!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Ya, Hapus!', cancelButtonText: 'Batal' }).then(async (result) => { 
        if (result.isConfirmed) { 
            let type = funcName === 'DasarHukum' ? 'hukum' : funcName.toLowerCase(); 
            showLoadingAnim('Menghapus Data');
            try {
                await callGAS('delete' + funcName, id);
                refreshAdminData(type); 
                Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success'); 
            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            }
        } 
    }); 
}

function loadPengaturanAdmin() { document.getElementById('set-app').value = appDataCache.infoUmum.nama_aplikasi || ''; document.getElementById('set-org').value = appDataCache.infoUmum.nama_organisasi || ''; document.getElementById('set-panjang').value = appDataCache.infoUmum.nama_panjang || ''; document.getElementById('set-sk').value = appDataCache.infoUmum.sk_kemenkumham || ''; document.getElementById('set-pengumuman').value = appDataCache.infoUmum.pengumuman || ''; document.getElementById('set-web').value = appDataCache.kontak.website || ''; document.getElementById('set-email').value = appDataCache.kontak.email || ''; document.getElementById('set-hp').value = appDataCache.kontak.telepon || appDataCache.kontak.whatsapp || ''; document.getElementById('set-alamat').value = appDataCache.kontak.alamat || ''; document.getElementById('set-ig').value = appDataCache.kontak.ig || ''; document.getElementById('set-fb').value = appDataCache.kontak.fb || ''; document.getElementById('set-x').value = appDataCache.kontak.x || ''; document.getElementById('set-yt').value = appDataCache.kontak.yt || ''; document.getElementById('set-tg').value = appDataCache.kontak.tg || ''; document.getElementById('set-tt').value = appDataCache.kontak.tt || ''; quillPrivasi.root.innerHTML = appDataCache.infoUmum.kebijakan_privasi || ''; }

async function savePengaturanUmum(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-save-pengaturan'); 
    showLoadingAnim('Menyimpan Pengaturan');
    const htmlPrivasi = quillPrivasi.root.innerHTML; 
    const data = { pengumuman: document.getElementById('set-pengumuman').value, nama_aplikasi: document.getElementById('set-app').value, nama_organisasi: document.getElementById('set-org').value, nama_panjang: document.getElementById('set-panjang').value, sk_kemenkumham: document.getElementById('set-sk').value, website: document.getElementById('set-web').value, email: document.getElementById('set-email').value, telepon: document.getElementById('set-hp').value, alamat: document.getElementById('set-alamat').value, ig: document.getElementById('set-ig').value, fb: document.getElementById('set-fb').value, x: document.getElementById('set-x').value, yt: document.getElementById('set-yt').value, tg: document.getElementById('set-tg').value, tt: document.getElementById('set-tt').value, kebijakan_privasi: htmlPrivasi }; 
    const fileLogo = document.getElementById('set-logo'); 
    
    try {
        if(fileLogo.files.length > 0) { 
            const b64 = await getBase64(fileLogo.files[0]); 
            const resUpload = await callGAS('uploadFileToDrive', { base64Data: b64, fileName: 'Logo_Baru.png' });
            if(resUpload && resUpload.success) { 
                data.logo_url = resUpload.url; 
                execSavePengaturan(data, btn); 
            } else { 
                Swal.fire('Gagal', resUpload?resUpload.error:'Error', 'error'); 
            } 
        } else { 
            execSavePengaturan(data, btn); 
        }
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
}

async function execSavePengaturan(data, btn) { 
    try {
        const res = await callGAS('savePengaturan', data);
        Swal.fire('Berhasil', res.message || 'Tersimpan!', 'success'); 
        refreshAdminData(null); 
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
}

function loadPetunjukAdmin() { document.getElementById('ptj-narasi').value = appDataCache.infoUmum.petunjuk_narasi || ''; document.getElementById('ptj-yt').value = appDataCache.infoUmum.petunjuk_youtube || ''; document.getElementById('adm-nama').value = appDataCache.infoUmum.admin_nama || ''; document.getElementById('adm-jabatan').value = appDataCache.infoUmum.admin_jabatan || ''; document.getElementById('adm-hp').value = appDataCache.infoUmum.admin_hp || ''; document.getElementById('adm-email').value = appDataCache.infoUmum.admin_email || ''; }

async function handleSavePetunjuk(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-save-ptj'); 
    showLoadingAnim('Menyimpan Data Petunjuk');
    const fileInput = document.getElementById('ptj-pdf'); 
    const narasi = document.getElementById('ptj-narasi').value; 
    const yt = document.getElementById('ptj-yt').value; 
    
    try {
        if (fileInput.files.length > 0) { 
            const base64 = await getBase64(fileInput.files[0]); 
            const resUpload = await callGAS('uploadFileToDrive', { base64Data: base64, fileName: fileInput.files[0].name });
            if(resUpload && resUpload.success) { 
                await callGAS('savePetunjuk', { narasi: narasi, ytUrl: yt, pdfUrl: resUpload.url });
                Swal.fire('Berhasil','Tersimpan!','success'); 
                refreshAdminData(null);
            } else { 
                Swal.fire('Gagal', resUpload?resUpload.error:'Error', 'error'); 
            } 
        } else { 
            await callGAS('savePetunjuk', { narasi: narasi, ytUrl: yt, pdfUrl: null });
            Swal.fire('Berhasil','Tersimpan!','success'); 
            refreshAdminData(null);
        }
    } catch(err) {
        Swal.fire('Error', err.message, 'error'); 
    }
}

async function execSaveAdminPusat(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btn-save-adm'); 
    const data = { admin_nama: document.getElementById('adm-nama').value, admin_jabatan: document.getElementById('adm-jabatan').value, admin_hp: document.getElementById('adm-hp').value, admin_email: document.getElementById('adm-email').value }; 
    btn.disabled = true; 
    showLoadingAnim('Menyimpan Data Admin');
    let base64Data = null; 
    if (cropperAdm) { base64Data = cropperAdm.getCroppedCanvas({width: 600, height: 800}).toDataURL('image/jpeg', 0.8); } 
    
    try {
        const res = await callGAS('prosesSimpanAdminPusat', { data: data, base64Data: base64Data });
        if(res && res.success) { 
            appDataCache = res.appData; 
            Swal.fire('Berhasil', 'Data Admin Pusat Tersimpan!', 'success'); 
            btn.disabled = false; 
        } else { 
            Swal.fire('Gagal', res?res.error:'Error', 'error'); 
            btn.disabled = false; 
        }
    } catch (err) {
        Swal.fire('Error', err.message, 'error'); 
        btn.disabled = false; 
    }
}

function getBase64(file) { return new Promise((res, rej) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload=()=>res(reader.result); reader.onerror=e=>rej(e); }); }

const pwaInstallModal = document.getElementById('pwa-install-modal');
const btnNantiPwa = document.getElementById('btn-nanti-pwa');
const btnInstallPwaModal = document.getElementById('btn-install-pwa-modal');
const linkPlaystore = "https://play.google.com/store/apps/details?id=kta.atas.indonesia";

function isRunningInApp() {
    return (window.matchMedia('(display-mode: standalone)').matches) || 
           (window.navigator.standalone === true) || 
           (document.referrer.includes('android-app://'));
}

window.addEventListener('DOMContentLoaded', () => {
    if (!isRunningInApp()) {
        setTimeout(() => { if(pwaInstallModal) pwaInstallModal.classList.remove('hidden'); }, 1500);
    }
});

if(btnInstallPwaModal) btnInstallPwaModal.addEventListener('click', () => { pwaInstallModal.classList.add('hidden'); window.location.href = linkPlaystore; });
if(btnNantiPwa) btnNantiPwa.addEventListener('click', () => { pwaInstallModal.classList.add('hidden'); });

window.addEventListener('scroll', () => {
    const btnScrollPortal = document.getElementById('btn-scroll-top-portal');
    if (btnScrollPortal) {
        if (window.scrollY > 200 || document.documentElement.scrollTop > 200) {
            btnScrollPortal.classList.remove('opacity-0', 'pointer-events-none');
            btnScrollPortal.classList.add('opacity-100');
        } else {
            btnScrollPortal.classList.remove('opacity-100');
            btnScrollPortal.classList.add('opacity-0', 'pointer-events-none');
        }
    }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./service-worker.js')
      .then(function(reg) { console.log('SW Terdaftar!', reg.scope); })
      .catch(function(err) { console.log('SW Gagal!', err); });
  });
}

// ====================================================================
// FUNGSI APLIKASI 2 (KTA)
// ====================================================================

function jalankanAplikasiKTA() {
    const urlParams = new URLSearchParams(window.location.search);
    var verifyId = urlParams.get('verify');
    if(verifyId) {
        renderValidationPage(verifyId);
        return; 
    }

    var safetyTimer = setTimeout(function() {
        var l = document.getElementById('loader');
        if(l && !l.classList.contains('hidden')) { showLoader(false); if(document.getElementById('app').innerHTML === "") { appData.settings = {nama: 'Aplikasi Keanggotaan', singkatan: 'APP', logo:''}; renderLogin(); } }
    }, 8000); 

    var savedSession = localStorage.getItem('atas_session');
    
    apiCall('getSettings').then(function(s) {
        clearTimeout(safetyTimer); appData.settings = s; showLoader(false); document.getElementById('app').className = ""; loadProvinces(); 
        
        if (savedSession) { 
            try { 
                var tempUser = JSON.parse(savedSession); 
                var userIdentifier = tempUser.data.username || tempUser.data.id;
                
                showLoader(true);
                apiCall('loginUser', { username: userIdentifier, password: tempUser.data.password }).then(function(res) {
                    showLoader(false);
                    if(res.status === 'success') {
                        appData.user = res;
                        localStorage.setItem('atas_session', JSON.stringify(res));
                        res.role.includes('admin') ? renderAdmin() : renderMember();
                    } else {
                        localStorage.removeItem('atas_session');
                        renderLogin();
                    }
                }).catch(function() { showLoader(false); renderLogin(); });
                
            } catch(e) { 
                localStorage.removeItem('atas_session'); renderLogin(); 
            } 
        } else { 
            renderLogin(); 
        } 
    }).catch(function(err){ 
        clearTimeout(safetyTimer); showLoader(false); 
        alert("Gagal koneksi API: " + err.message); // <--- Biar ketahuan error aslinya!
    });
}

var scrollBtn = document.getElementById("scrollTopBtn");
window.onscroll = function() { 
    if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) { 
        if(scrollBtn) scrollBtn.style.display = "block"; 
    } else { 
        if(scrollBtn) scrollBtn.style.display = "none"; 
    } 
};

function scrollToTop() { document.body.scrollTop = 0; document.documentElement.scrollTop = 0; }

var loaderInterval = null;
function showLoader(show, customText) { 
    var l = document.getElementById('loader'); 
    if(!l) return;
    var p = l.querySelector('p');
    if(!p) return;
    
    p.style.textAlign = "center";
    p.style.lineHeight = "1.5";

    if(show) {
        l.classList.remove('hidden');
        var timer = 5; 
        var baseText = customText || 'MEMUAT...';
        p.innerHTML = baseText + '<br><span style="font-size:24px; color:#ef4444; font-weight:800; display:block; margin-top:5px;">' + timer + '</span>';
        
        clearInterval(loaderInterval);
        loaderInterval = setInterval(function() {
            timer--;
            if(timer > 0) {
                p.innerHTML = baseText + '<br><span style="font-size:24px; color:#ef4444; font-weight:800; display:block; margin-top:5px;">' + timer + '</span>';
            } else {
                clearInterval(loaderInterval);
                p.innerHTML = 'Data sedang diproses, mohon tunggu...<br><span style="font-size:12px; color:#666; font-weight:normal;">(Server sedang memuat...)</span>';
            }
        }, 1000); 
    } else {
        clearInterval(loaderInterval);
        l.classList.add('hidden');
        p.innerHTML = 'MEMUAT...'; 
    }
}

function notify(icon, title, text) { Swal.fire({ icon: icon, title: title, text: text, showConfirmButton: false, timer: 2000, toast: true, position: 'top-end' }); }

function getImageUrl(url) { 
    if(!url || typeof url !== 'string' || url.length < 5) return 'https://via.placeholder.com/150?text=NO+IMG'; 
    if(url.startsWith('data:image')) return url;
    var id = ""; var m1 = url.match(/id=([^&]+)/); var m2 = url.match(/\/d\/([^/]+)/);
    if (m1) id = m1[1]; else if (m2) id = m2[1];
    if (id) return 'https://lh3.googleusercontent.com/d/' + id; 
    return url; 
}

function closeModalKTA(id){ document.getElementById(id).classList.remove('active'); }
function openModal(id){ document.getElementById(id).classList.add('active'); }

function renderLogin() {
  var overlay = document.getElementById('sidebarOverlay'); if(overlay) overlay.remove(); 
  var btnRef = document.querySelector('#wrapper-kta .btn-refresh-float'); if(btnRef) btnRef.style.display = 'none';
  var s = appData.settings || {nama:'Loading...', singkatan:'APP', logo:''};
  var cleanLogo = getImageUrl(s.logo);
  var html = '<div class="login-body"><div class="marquee-bar"><marquee>📢 '+ (s.running||'Selamat Datang') +'</marquee></div>';
  html += '<div class="glass-card"><img src="'+cleanLogo+'" class="logo-anim" onerror="this.src=\'https://via.placeholder.com/100?text=LOGO\';">';
  html += '<h3>'+s.singkatan+'</h3><p style="color:var(--text-gray);margin-bottom:25px">'+s.nama+'<br>'+(s.provinsi_default||'')+'</p>';
  html += '<form onsubmit="doLogin(event)"><input type="text" id="u" placeholder="Username/NIA" required>';
  html += '<div style="position:relative; margin-top:10px;"><input type="password" id="p" placeholder="Password" required style="padding-right:45px;"><i class="fa fa-eye" id="togglePass" onclick="togglePasswordLogin()" style="position:absolute; right:15px; top:50%; transform:translateY(-50%); cursor:pointer; color:#64748b; font-size:18px;"></i></div>';
  html += '<button type="submit" class="btn-glow">MASUK</button><div style="margin-top:15px; text-align:center;"><a onclick="showForgotInfo()" style="color:#ef4444;font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline;">Lupa Password?</a></div></form>';

  html += '<div class="desktop-login-actions">'; 
  html += '<button onclick="openSearchModal()" class="btn btn-green" style="width:100%;margin-top:10px;justify-content:center;border-color:rgba(255,255,255,0.3);color:white"><i class="fa fa-search"></i> Cek Data Anggota</button>';
  html += '<button onclick="openRegistrationModal()" class="btn btn-orange" style="width:100%;margin-top:10px;justify-content:center;"><i class="fa fa-user-plus"></i> Isi Formulir Pendaftaran</button>';
  html += '<div class="contact-icons" style="text-align:center"><p style="font-size:11px; margin-bottom:5px; font-weight:bold; color:#666">Contact Center :</p>';
  if(s.wa) html += '<a href="https://wa.me/'+s.hp+'" target="_blank" class="c-icon"><i class="fab fa-whatsapp"></i></a>';
  if(s.hp) html += '<a href="tel:'+s.hp+'" class="c-icon"><i class="fa fa-phone"></i></a>';
  if(s.web) html += '<a href="'+(s.web.startsWith('http')?s.web:'http://'+s.web)+'" target="_blank" class="c-icon"><i class="fa fa-globe"></i></a>';
  if(s.email) html += '<a href="mailto:'+s.email+'" class="c-icon"><i class="fa fa-envelope"></i></a>';
  html += '</div></div>';

  html += '</div><div style="color:white;opacity:0.9;margin-top:auto;padding:20px;text-align:center;font-size:12px;line-height:1.6">© '+new Date().getFullYear()+' '+s.nama+'<br><a onclick="showPrivacyPolicy()" style="color:white;text-decoration:underline;cursor:pointer;font-weight:600">Kebijakan Privasi</a> • Hak Cipta Dilindungi.<br><div style="margin-top:11px;font-size:11px;opacity:0.7">Created by <a href="https://www.farypin-inovasiteknologi.com/" target="_blank" style="color:white;text-decoration:none;font-weight:bold;border-bottom:1px dotted white">PT Farypin Inovasi Teknologi</a></div></div></div>';

  html += '<div class="login-bottom-bar">';
  html += '<a onclick="kembaliKePortal()" class="nav-item cursor-pointer"><i class="fa fa-home"></i><span>Home</span></a>';
  html += '<a onclick="openRegistrationModal()" class="nav-item"><i class="fa fa-file-alt"></i><span>Daftar</span></a>';
  html += '<a onclick="openSearchModal()" class="nav-item"><i class="fa fa-search"></i><span>Cek Anggota</span></a>';
  html += '<a onclick="openContactPopup()" class="nav-item"><i class="fa fa-headset"></i><span>Helpdesk</span></a>';
  html += '</div>';

  document.getElementById('app').innerHTML = html;
}

function renderAdmin() {
   var btnRef = document.querySelector('#wrapper-kta .btn-refresh-float'); if(btnRef) btnRef.style.display = 'flex';
   var s = appData.settings; var u = appData.user; var isSuper = (u.role === 'superadmin' || u.role === 'super');
   var roleBadge = isSuper ? '<span style="background:#ffedd5;color:#c2410c;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:10px;border:1px solid #fed7aa">SUPER ADMIN</span>' : '<span style="background:#e0e7ff;color:#4338ca;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:10px">ADMIN</span>';
   var cleanLogo = getImageUrl(s.logo);

   var mobileUIAdmin = '<div class="mobile-header"><div class="mobile-header-left"><img src="'+cleanLogo+'" onerror="this.src=\'https://via.placeholder.com/100?text=LOGO\';"><div><h3 style="margin:0; font-size:18px;">'+s.singkatan+'</h3></div></div><div class="mobile-header-right">'+(isSuper ? '<span style="color:#c2410c;font-weight:800;font-size:11px;">SUPER ADMIN</span>' : '<span style="color:#4338ca;font-weight:800;font-size:11px;">ADMIN</span>')+'</div></div>';
   mobileUIAdmin += '<div class="mobile-bottom-bar"><a class="nav-item" onclick="switchTab(\'data\')"><i class="fa fa-users"></i><span>Anggota</span></a><a class="nav-item" onclick="openAdminProfile()"><i class="fa fa-user-circle"></i><span>Profil</span></a><a class="nav-item-center" onclick="switchTab(\'dash\')"><i class="fa fa-home"></i></a><a class="nav-item" href="'+(s.hp ? 'https://wa.me/'+s.hp : '#')+'" target="_blank"><i class="fa fa-comments"></i><span>Chat Pusat</span></a><a class="nav-item" onclick="doLogout()"><i class="fa fa-sign-out-alt"></i><span>Keluar</span></a></div>';

   var html = '<div class="dashboard-layout"><div class="sidebar"><div class="sidebar-head"><h3>ADMIN PANEL</h3></div><div class="menu">';
   html += '<a class="menu-item active" id="mDash" onclick="switchTab(\'dash\')"><i class="fa fa-home"></i> Beranda</a>';
   html += '<a class="menu-item" id="mData" onclick="switchTab(\'data\')"><i class="fa fa-users"></i> Data Anggota</a>';
   if(isSuper) html += '<a class="menu-item" id="mSet" onclick="switchTab(\'setting\')"><i class="fa fa-cogs"></i> Pengaturan</a>';
   html += '<a onclick="openAdminProfile()" class="menu-item"><i class="fa fa-user-circle"></i> Profil Saya</a>';
   html += '<a onclick="kembaliKePortal()" class="menu-item"><i class="fa fa-globe"></i> Portal Utama</a>';
   html += '<a onclick="doLogout()" class="menu-item" style="color:#ef4444;margin-top:20px"><i class="fa fa-sign-out-alt"></i> Logout</a></div></div>';
   
   html += '<div class="main">' + mobileUIAdmin + '<div class="content">';
   html += '<div class="admin-header"><button onclick="toggleSidebar()" class="btn btn-outline mobile-menu-btn"><i class="fa fa-bars"></i></button>'; 
   html += '<div class="org-branding" style="display:flex;align-items:center;gap:15px"><img src="'+cleanLogo+'" onerror="this.src=\'https://via.placeholder.com/100?text=LOGO\';" style="height:50px;width:auto;object-fit:contain"><div><h2 style="font-weight:700">'+s.singkatan+'</h2><div style="display:flex;align-items:center"><p style="color:var(--text-gray)">'+s.nama+'</p>'+roleBadge+'</div></div></div>';
   if(s.hp) html += '<a href="https://wa.me/'+s.hp+'" target="_blank" class="btn btn-outline admin-contact-btn"><i class="fab fa-whatsapp"></i> Chat Pusat</a>';
   html += '</div>';

   html += '<div id="viewDash"><div class="stat-row">';
   html += '<div class="stat-box"><div class="stat-icon c-blue"><i class="fa fa-users"></i></div><div><small>Total Anggota</small><h2 id="stTot">...</h2></div></div>';
   html += '<div class="stat-box"><div class="stat-icon c-green"><i class="fa fa-check-circle"></i></div><div><small>Aktif</small><h2 id="stAct">...</h2></div></div>';
   html += '<div class="stat-box"><div class="stat-icon c-orange"><i class="fa fa-clock"></i></div><div><small>Belum Aktif</small><h2 id="stBelum">...</h2></div></div>';
   html += '</div><div class="card"><h3>Sebaran Wilayah</h3><div style="height:300px"><canvas id="cityChart"></canvas></div></div></div>';
   
   html += '<div id="viewData" class="hidden"><div style="display:flex;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px"><h2>Data Anggota</h2><div><button class="btn btn-outline" onclick="exportExcel()" style="margin-right:5px"><i class="fa fa-file-excel"></i> Export (Sesuai Filter)</button><button class="btn btn-primary" onclick="openAdminModal()">+ Tambah</button></div></div>';
   html += '<div class="filters"><input type="text" placeholder="Cari Nama/NIK..." onkeyup="handleSearch()" id="sKey"><select id="fUnit" onchange="handleSearch()"><option value="">Semua Unit</option></select><select id="fKab" onchange="handleSearch()"><option value="">Semua Wilayah</option></select><select id="fStatus" onchange="handleSearch()"><option value="">Semua Status</option><option value="AKTIF">AKTIF</option><option value="BELUM AKTIF">BELUM AKTIF</option><option value="PENSIUN">PENSIUN</option><option value="NONAKTIF/MUTASI">NONAKTIF</option></select></div>';
   html += '<div class="table-box"><table><thead><tr><th>ID/NIA</th><th>Nama</th><th>Kab/Kota</th><th>Unit</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tableBody"></tbody></table></div><div style="margin-top:15px;display:flex;justify-content:space-between;align-items:center"><div id="pageInfo" style="font-size:13px;color:#666"></div><div><button class="btn btn-sm btn-outline" onclick="changePage(-1)">< Prev</button> <button class="btn btn-sm btn-outline" onclick="changePage(1)">Next ></button></div></div></div>';
   
   if(isSuper) {
       html += '<div id="viewSetting" class="hidden"><div class="card" style="max-width:1000px;margin:0 auto"><h3 style="margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid #eee"><i class="fa fa-lock"></i> Pengaturan Aplikasi (Terkunci)</h3>';
       html += '<div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:12px; padding:25px; text-align:center;">';
       html += '<i class="fa fa-shield-alt" style="font-size:40px; color:#4f46e5; margin-bottom:15px;"></i>';
       html += '<h4 style="color:#1e293b; font-size:18px; margin-bottom:10px;">Sistem Terpusat Aktif</h4>';
       html += '<p style="color:#64748b; font-size:14px; margin-bottom:25px;">Seluruh identitas organisasi, logo, running text, serta nama dan kontak Admin Provinsi <b>sepenuhnya dikendalikan oleh Admin Pusat</b> melalui Portal Utama.</p>';
       
       html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; text-align:left;">';
       html += '<div><label style="font-size:11px; color:#94a3b8;">Organisasi</label><input type="text" value="'+(s.nama||'')+'" readonly style="background:#e2e8f0; color:#64748b; border:none; cursor:not-allowed;"></div>';
       html += '<div><label style="font-size:11px; color:#94a3b8;">Running Text</label><input type="text" value="'+(s.running||'')+'" readonly style="background:#e2e8f0; color:#64748b; border:none; cursor:not-allowed;"></div>';
       html += '<div><label style="font-size:11px; color:#94a3b8;">Provinsi Default</label><input type="text" value="'+(s.provinsi_default||'')+'" readonly style="background:#e2e8f0; color:#64748b; border:none; cursor:not-allowed;"></div>';
       html += '<div><label style="font-size:11px; color:#94a3b8;">Admin Prov & WA</label><input type="text" value="'+(s.nama_admin_prov||'')+' ('+(s.wa||s.hp||'')+')" readonly style="background:#e2e8f0; color:#64748b; border:none; cursor:not-allowed;"></div>';
       html += '</div>'; // End Grid
       
       html += '<button type="button" onclick="switchTab(\'data\')" class="btn btn-primary" style="margin-top:25px; width:100%;">KEMBALI KE DATA ANGGOTA</button>';
       html += '</div></div></div>';
   }

   html += '<div style="color:#64748b;opacity:0.9;margin-top:auto;padding:20px;text-align:center;font-size:12px;line-height:1.6; border-top:1px solid #e2e8f0;">';
   html += '© '+new Date().getFullYear()+' '+s.nama+'<br>';
   html += '<a onclick="showPrivacyPolicy()" style="color:#4f46e5;text-decoration:underline;cursor:pointer;font-weight:600">Kebijakan Privasi</a> • Hak Cipta Dilindungi.</div></div></div></div>';
   document.getElementById('app').innerHTML = html;
   loadData(); loadDashboardStats(); populateFilters();
}

function renderMember() {
    var btnRef = document.querySelector('#wrapper-kta .btn-refresh-float'); if(btnRef) btnRef.style.display = 'flex';
    if(!appData.user || !appData.user.data) { Swal.fire('Error Session', 'Data profil tidak lengkap. Login ulang.', 'error').then(()=> doLogout()); return; }

    var u = appData.user.data; var safe=v=>v||'-'; var s=appData.settings;
    var cleanLogo = getImageUrl(s.logo);
    
    var mobileUIMember = '<div class="mobile-header"><div class="mobile-header-left"><img src="'+cleanLogo+'" onerror="this.src=\'https://via.placeholder.com/100?text=LOGO\';"><div><h3 style="margin:0; font-size:18px;">'+s.singkatan+'</h3></div></div><div class="mobile-header-right" onclick="openChangePass()" style="cursor:pointer;"><i class="fa fa-key" style="font-size:16px; color:#4f46e5; margin-bottom:2px;"></i><span style="font-size:9px; font-weight:600; color:#64748b;">Ubah Sandi</span></div></div>';
    mobileUIMember += '<div class="mobile-bottom-bar"><a class="nav-item active" onclick="scrollToTop()"><i class="fa fa-home"></i><span>Home</span></a><a class="nav-item" onclick="openSelfEdit()"><i class="fa fa-user-edit"></i><span>Edit Profil</span></a><a class="nav-item-center" onclick="checkAndOpenKta(appData.user.data)"><i class="fa fa-id-badge" style="margin-top:4px;"></i><span>Buat KTA</span></a><a class="nav-item" onclick="openContactPopup()"><i class="fa fa-headset"></i><span>Bantuan</span></a><a class="nav-item" onclick="doLogout()"><i class="fa fa-sign-out-alt"></i><span style="font-weight:300; font-size:9px;">Keluar</span></a></div>';

    var html = '<div class="dashboard-layout"><div class="sidebar"><div class="sidebar-head"><h3>ANGGOTA</h3></div><div class="menu"><a class="menu-item active"><i class="fa fa-user"></i> Profil</a><a onclick="kembaliKePortal()" class="menu-item"><i class="fa fa-globe"></i> Portal Utama</a><a onclick="doLogout()" class="menu-item" style="color:red"><i class="fa fa-sign-out-alt"></i> Logout</a></div></div>';
    
    html += '<div class="main">' + mobileUIMember + '<div class="content">';
    html += '<div class="admin-header"><button onclick="toggleSidebar()" class="btn btn-outline mobile-menu-btn"><i class="fa fa-bars"></i></button><div class="org-branding" style="display:flex;align-items:center;gap:15px"><img src="'+cleanLogo+'" onerror="this.src=\'https://via.placeholder.com/100?text=LOGO\';" style="height:50px;width:auto;object-fit:contain"><div><h2 style="font-weight:700">'+s.singkatan+'</h2><p style="color:var(--text-gray)">'+s.nama+'</p></div></div>';
    html += '<div class="admin-contact-btn" style="display:flex; gap:10px;">';
    if(s.hp) html += '<a href="https://wa.me/'+s.hp+'" target="_blank" class="btn btn-outline" style="border-color:#ea580c; color:#ea580c;"><i class="fab fa-whatsapp"></i> Admin Pusat</a>';
    if(s.wa) html += '<a href="https://wa.me/'+s.wa+'" target="_blank" class="btn btn-green"><i class="fab fa-whatsapp"></i> Admin Prov</a>';
    html += '</div></div>';

    html += '<div class="card" style="padding:0;overflow:hidden;margin-bottom:30px"><div class="profile-hero"><div class="hero-avatar"><img src="'+getImageUrl(u.foto)+'" style="width:100%;height:100%;object-fit:cover;border-radius:15px"></div>';
    html += '<div class="hero-info"><div class="hero-name">'+safe(u.nama)+'</div><div class="hero-role">'+safe(u.jabatan)+' • '+safe(u.unit)+'</div></div>';
    html += '<div class="hero-actions"><button class="hero-btn" onclick="openSelfEdit()"><i class="fa fa-pencil-alt"></i> Edit Profil</button><button class="hero-btn" onclick="openChangePass()"><i class="fa fa-key"></i> Ganti Password</button></div></div>';
    
    html += '<div class="member-content-pad" style="padding:60px 30px 30px 30px"><div class="info-grid-container">';
    html += '<div class="info-card"><div class="info-header"><i class="fa fa-id-card"></i> PRIBADI</div><div class="info-body"><div class="data-row"><div class="data-label">Nama</div><div class="data-val">'+safe(u.nama)+'</div></div><div class="data-row"><div class="data-label">NIK</div><div class="data-val">'+safe(u.nik)+'</div></div><div class="data-row"><div class="data-label">TTL</div><div class="data-val">'+safe(u.tempat_lahir)+', '+safe(u.tgl_lahir)+'</div></div><div class="data-row"><div class="data-label">JK</div><div class="data-val">'+safe(u.jk)+'</div></div><div class="data-row"><div class="data-label">Agama</div><div class="data-val">'+safe(u.agama)+'</div></div><div class="data-row"><div class="data-label">HP/WA</div><div class="data-val">'+safe(u.hp)+'</div></div><div class="data-row"><div class="data-label">Email</div><div class="data-val" style="max-width:60%">'+safe(u.email)+'</div></div><div class="data-row"><div class="data-label">Alamat</div><div class="data-val" style="max-width:60%">'+safe(u.alamat)+'</div></div></div></div>';
    
    html += '<div class="info-card"><div class="info-header"><i class="fa fa-building"></i> INSTANSI</div><div class="info-body"><div class="data-row"><div class="data-label">Unit</div><div class="data-val">'+safe(u.unit)+'</div></div><div class="data-row"><div class="data-label">Jabatan</div><div class="data-val">'+safe(u.jabatan)+'</div></div><div class="data-row"><div class="data-label">Pendidikan</div><div class="data-val">'+safe(u.pendidikan)+'</div></div><div class="data-row"><div class="data-label">Status Sek</div><div class="data-val">'+safe(u.status_sekolah)+'</div></div><div class="data-row"><div class="data-label">Jenjang</div><div class="data-val">'+safe(u.jenjang)+'</div></div><div class="data-row"><div class="data-label">Mulai Tugas</div><div class="data-val">'+safe(u.mulai_tugas)+'</div></div><div class="data-row"><div class="data-label">Status Peg</div><div class="data-val">'+safe(u.status_pegawai)+'</div></div><div class="data-row"><div class="data-label">Provinsi</div><div class="data-val">'+safe(u.provinsi)+'</div></div><div class="data-row"><div class="data-label">Kabupaten</div><div class="data-val">'+safe(u.kabupaten)+'</div></div></div></div>';
    
    html += '<div class="info-card"><div class="info-header"><i class="fa fa-users"></i> KEANGGOTAAN</div><div class="info-body"><div class="data-row"><div class="data-label">NIA</div><div class="data-val" style="color:#4f46e5;font-weight:bold">'+safe(u.nia_lengkap)+'</div></div><div class="data-row"><div class="data-label">Jab. Org</div><div class="data-val">'+safe(u.jabatan_org)+'</div></div><div class="data-row"><div class="data-label">Tingkat</div><div class="data-val">'+safe(u.tingkat_pengurus)+'</div></div><div class="data-row"><div class="data-label">Status</div><div class="data-val">'+safe(u.status_anggota)+'</div></div><div class="data-row"><div class="data-label">Masa KTA</div><div class="data-val" style="color:#d97706;font-weight:bold">'+safe(u.masa_kta)+'</div></div>';
    
    var isAktif = (u.status_anggota === 'AKTIF');
    var isLengkap = isNiaComplete(u);
    
    if(u.link_kta && u.link_kta.length > 5) { 
        if(isAktif && isLengkap) { html += '<a href="'+u.link_kta+'" target="_blank" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:15px">Download KTA (PDF)</a>'; } 
        else { html += '<button onclick="Swal.fire(\'Terkunci\',\'Lengkapi Data & Status Harus AKTIF\',\'warning\')" class="btn btn-outline" style="width:100%;margin-top:15px;background:#eee;color:#777"><i class="fa fa-lock"></i> KTA PDF Terkunci</button>'; }
    }
    
    if(isAktif && isLengkap) {
        html += '<button onclick="checkAndOpenKta(appData.user.data)" class="btn btn-orange" style="width:100%;margin-top:10px">Buat KTA Digital</button>';
        html += '<button onclick="checkAndDownloadBg(appData.user.data)" class="btn btn-outline" style="width:100%;margin-top:10px;border-style:dashed;color:#4f46e5"><i class="fa fa-image"></i> Unduh KTA Belakang</button>';
    } else {
        html += '<button onclick="Swal.fire(\'Info\',\'Lengkapi NIA & Status AKTIF\',\'info\')" class="btn btn-outline" style="width:100%;margin-top:10px;background:#eee;color:#777">KTA Digital Pending</button>';
    }
    
    html += '</div></div></div></div>';
    html += '<div style="color:#64748b;opacity:0.9;margin-top:auto;padding:20px;text-align:center;font-size:12px;line-height:1.6; border-top:1px solid #e2e8f0;">';
    html += '© '+new Date().getFullYear()+' '+s.nama+'<br>';
    html += '<a onclick="showPrivacyPolicy()" style="color:#4f46e5;text-decoration:underline;cursor:pointer;font-weight:600">Kebijakan Privasi</a> • Hak Cipta Dilindungi.</div></div></div></div>';
    document.getElementById('app').innerHTML = html;
}

function viewDetail(idx) { 
    try {
        if (!appData.members || !appData.members[idx]) return;
        var d = appData.members[idx]; currentDetailMember = d; var safe=v=>(v && v!=='undefined')?v:'-'; 
        
        document.getElementById('dName').innerText = d.nama; 
        document.getElementById('dFoto').src = getImageUrl(d.foto); 
        document.getElementById('dJob').innerText = safe(d.jabatan)+" ("+safe(d.unit)+")"; 
        
        var stColor = 'color:#666';
        if(d.status_anggota === 'AKTIF') stColor = 'color:green';
        if(String(d.status_anggota).includes('NONAKTIF')) stColor = 'color:red';
        document.getElementById('dStatus').innerHTML = '<span style="'+stColor+';font-weight:bold">'+(d.status_anggota||'BELUM AKTIF')+'</span>'; 
        
        var html = '<div class="data-row"><div class="data-label">ID</div><div>'+d.id+'</div></div>';
        html += '<div class="data-row"><div class="data-label">NIK</div><div>'+safe(d.nik)+'</div></div>';
        html += '<div class="data-row"><div class="data-label">Agama</div><div>'+safe(d.agama)+'</div></div>';
        html += '<div class="data-row"><div class="data-label">HP</div><div>'+safe(d.hp)+'</div></div>';
        html += '<div class="data-row"><div class="data-label">Email</div><div>'+safe(d.email)+'</div></div>';
        html += '<div class="data-row"><div class="data-label">TTL</div><div>'+safe(d.tempat_lahir)+', '+safe(d.tgl_lahir)+'</div></div>';
        html += '<div class="data-row"><div class="data-label">Jenjang</div><div>'+safe(d.jenjang)+'</div></div>';
        html += '<div class="data-row"><div class="data-label">Mulai</div><div>'+safe(d.mulai_tugas)+'</div></div>';
        html += '<div class="data-row"><div class="data-label">Alamat</div><div>'+safe(d.alamat)+'</div></div>';
        html += '<div class="data-row"><div class="data-label">NIA</div><div>'+safe(d.nia_lengkap)+'</div></div>';
        html += '<div class="data-row"><div class="data-label">Masa</div><div>'+safe(d.masa_kta)+'</div></div>';
        
        document.getElementById('dContent').innerHTML = html; 
        
        var btns = ''; 
        if(d.link_kta && d.link_kta.length > 5) { 
            var isAktif = (d.status_anggota === 'AKTIF');
            if(isAktif) { btns += '<a href="'+d.link_kta+'" target="_blank" class="btn btn-primary" style="width:100%;margin-bottom:5px">Download KTA (PDF)</a>'; } 
            else { btns += '<button type="button" class="btn btn-outline" style="width:100%;margin-bottom:5px;background:#eee;color:#777" onclick="Swal.fire(\'Terkunci\',\'Status Anggota belum AKTIF. Hubungi Admin.\',\'warning\')"><i class="fa fa-lock"></i> KTA PDF Terkunci</button>'; } 
        } 
        
        if(d.status_anggota === 'AKTIF' && isNiaComplete(d)) {
             btns += '<button onclick="checkAndOpenKta(appData.members['+idx+'])" class="btn btn-orange" style="width:100%;margin-top:5px">Buat KTA Digital (PNG)</button>';
        } else {
             btns += '<button onclick="Swal.fire(\'Info\',\'Data belum lengkap atau belum aktif\',\'info\')" class="btn btn-outline" style="width:100%;margin-top:5px;font-size:12px">Preview KTA Belum Tersedia</button>';
        }
        document.getElementById('dAction').innerHTML = btns; 
        openModal('detailModal'); 
    } catch(e) { console.error(e); Swal.fire('Error', 'Gagal memuat detail', 'error'); }
}

function switchSearchMode(mode) { currentSearchMode = mode; document.getElementById('searchResultArea').style.display = 'none'; if(mode === 'nik') { document.getElementById('searchBoxNik').style.display = 'block'; document.getElementById('searchBoxBio').style.display = 'none'; document.getElementById('btnModeNik').className = 'btn btn-sm btn-primary'; document.getElementById('btnModeBio').className = 'btn btn-sm btn-outline'; } else { document.getElementById('searchBoxNik').style.display = 'none'; document.getElementById('searchBoxBio').style.display = 'block'; document.getElementById('btnModeNik').className = 'btn btn-sm btn-outline'; document.getElementById('btnModeBio').className = 'btn btn-sm btn-primary'; } }
function openSearchModal() { document.getElementById('publicNikInput').value = ""; document.getElementById('publicNameInput').value = ""; document.getElementById('publicTglInput').value = ""; document.getElementById('searchResultArea').style.display = "none"; switchSearchMode('nik'); openModal('searchModal'); }

function handlePublicSearch() { 
    var payload = {}; 
    if (currentSearchMode === 'nik') { 
        var nik = document.getElementById('publicNikInput').value; 
        if(nik.length < 5) { Swal.fire('Input Salah', 'Masukkan NIK dengan benar', 'warning'); return; } 
        payload = { nik: nik }; 
    } else { 
        var nama = document.getElementById('publicNameInput').value; 
        var tgl = document.getElementById('publicTglInput').value; 
        if(nama.length < 3) { Swal.fire('Nama Pendek', 'Masukkan minimal 3 huruf nama', 'warning'); return; } 
        if(!tgl) { Swal.fire('Tanggal', 'Pilih tanggal lahir', 'warning'); return; } 
        payload = { nama: nama, tgl: tgl }; 
    } 
    
    showLoader(true); 
    apiCall('searchMemberPublic', payload).then(function(res){ 
        showLoader(false); 
        var area = document.getElementById('searchResultArea'); area.style.display = "block"; 
        if(res.found) { 
            var html = '<h4 style="margin:0 0 10px 0;color:#16a34a"><i class="fa fa-check-circle"></i> Data Ditemukan.</h4>'; 
            html += '<strong>'+res.nama+'</strong><br><span style="color:#666">NIA: <b style="color:#4f46e5">'+(res.nia||"Belum Ada")+'</b></span><br><span style="color:#666">'+(res.kabupaten||"-")+'</span><br>'; 
            var badgeColor = res.status === 'AKTIF' ? '#dcfce7' : '#ffedd5'; var textColor = res.status === 'AKTIF' ? '#16a34a' : '#c2410c'; 
            html += '<span style="color:#666">Status: <span style="background:'+badgeColor+';color:'+textColor+';padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold">'+res.status+'</span></span>'; 
            html += '<div style="margin-top:10px;font-size:12px;color:#666;border-top:1px solid #eee;padding-top:10px">Silakan Login menggunakan NIA/Username dan Password Anda. <br> - Bagi anggota yang pertama kali login, harus menggunakan password standar (123456).</div>'; 
            area.innerHTML = html; 
        } else { 
            area.innerHTML = '<h4 style="margin:0 0 10px 0;color:#ef4444"><i class="fa fa-times-circle"></i> Data Tidak Ditemukan</h4><p style="margin:0;font-size:13px;color:#666">Pastikan data yang dimasukkan sesuai (NIK atau Nama & Tgl Lahir).</p>'; 
        } 
    }).catch(function(e) { showLoader(false); Swal.fire('Error', 'Gagal pencarian: '+e.message, 'error'); }); 
}

function openRegistrationModal() { document.getElementById('formReg').reset(); document.getElementById('r_preview').innerHTML = ""; document.getElementById('r_base64').value = ""; document.getElementById('r_preview_container').style.display = 'none'; if (appData.settings) { document.getElementById('lblRegOrg').innerText = appData.settings.nama; document.getElementById('lblRegProv').innerText = appData.settings.provinsi_default; } var provSelect = document.getElementById('r_prov'); if (provSelect.options.length <= 1) { loadProvinces(); } setTimeout(function() { var pId = setProvDropdown('r_prov', appData.settings.provinsi_default); if(pId) loadRegencies(pId, 'r_kab'); }, 800); openModal('regModal'); }

function handleFileAndCrop(event) { var file = event.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function(e) { document.getElementById('r_preview_container').style.display = 'block'; document.getElementById('final_preview_container').innerHTML = ''; if (croppieInstance) croppieInstance.destroy(); croppieInstance = new Croppie(document.getElementById('crop_area'), { viewport: { width: 150, height: 200, type: 'square' }, boundary: { width: 300, height: 300 }, showZoomer: true, enableOrientation: true }); croppieInstance.bind({ url: e.target.result }); }; reader.readAsDataURL(file); }
function saveCrop() { if (!croppieInstance) return; croppieInstance.result({ type: 'base64', size: { width: 600, height: 800 }, format: 'jpeg', quality: 0.8 }).then(function(base64) { document.getElementById('r_base64').value = base64; document.getElementById('r_preview_container').style.display = 'none'; document.getElementById('final_preview_container').innerHTML = '<p style="color:green; font-size:12px">Foto Berhasil Dikunci!</p><img src="'+base64+'" style="width:120px; border-radius:8px; border:2px solid #10b981">'; notify('success', 'Foto Siap!', ''); }); }

function handleRegistration(e) { 
    e.preventDefault(); 
    var nikInput = document.getElementById('r_nik').value;
    if (nikInput.length !== 16) { Swal.fire('Format Salah', 'NIK / No. KTP harus berjumlah tepat 16 digit angka.', 'warning'); return; }
    var b64 = document.getElementById('r_base64').value; 
    if(!b64) { Swal.fire('Foto Wajib', 'Silakan upload dan tunggu proses crop foto selesai.', 'warning'); return; } 

    var submitBtn = e.target.querySelector('button[type="submit"]');
    var originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> MEMPROSES...';
    
    showLoader(true, 'MENGUNGGAH DATA...'); 
    
    apiCall('uploadToDrive', { base64Data: b64, filename: "REG_" + nikInput }).then(function(url) { 
        if(!url) { showLoader(false); submitBtn.disabled = false; submitBtn.innerHTML = originalBtnHtml; Swal.fire('Error', 'Gagal upload foto ke server.', 'error'); return; }

        var formData = { 
            nik: nikInput, nama: document.getElementById('r_nama').value, tempat_lahir: document.getElementById('r_tmp').value, 
            tgl_lahir: document.getElementById('r_tgl').value, jk: document.getElementById('r_jk').value, 
            agama: document.getElementById('r_agama').value, hp: document.getElementById('r_hp').value, 
            email: document.getElementById('r_email').value, pendidikan: document.getElementById('r_pend').value, 
            alamat: document.getElementById('r_alamat').value, unit: document.getElementById('r_unit').value, 
            jabatan: document.getElementById('r_jab').value, status_pegawai: document.getElementById('r_statPeg').value, 
            status_sekolah: document.getElementById('r_statSek').value, 
            provinsi: document.getElementById('r_prov').options[document.getElementById('r_prov').selectedIndex].text, 
            kabupaten: document.getElementById('r_kab').value, foto_url: url 
        };

        return apiCall('checkAndRegisterMember', formData);
    }).then(function(res) { 
        showLoader(false); submitBtn.disabled = false; submitBtn.innerHTML = originalBtnHtml; 
        if(res.status === 'success') { 
            closeModalKTA('regModal'); Swal.fire({ icon: 'success', title: 'Pendaftaran Berhasil!', html: 'Silakan Login dengan:<br><b>Username: ' + res.username + '</b><br><b>Password: ' + res.password + '</b><br><br><small>Harap segera lengkapi data dan cek status.</small>', confirmButtonText: 'SAYA MENGERTI' }); 
        } else if(res.status === 'duplicate') { 
            Swal.fire('Data Ganda', res.message, 'warning'); 
        } else { 
            Swal.fire('Gagal', res.message, 'error'); 
        } 
    }).catch(function(err) {
        showLoader(false); submitBtn.disabled = false; submitBtn.innerHTML = originalBtnHtml; Swal.fire('Error System', err.message, 'error');
    });
}

function showPrivacyPolicy() { var s = appData.settings || {nama: 'Organisasi'}; var html = '<div style="text-align:left; font-size:13px; color:#333; max-height:350px; overflow-y:auto; padding-right:5px; line-height:1.6"><p><strong>Terakhir Diperbarui: '+new Date().toLocaleDateString('id-ID')+'</strong></p><h4>1. Pendahuluan</h4><p>Selamat datang di sistem pendataan dan keanggotaan <b>'+s.nama+'</b>. Kami menghargai dan berkomitmen penuh untuk melindungi privasi serta Data Pribadi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, memproses, menyimpan, dan melindungi Data Pribadi Anda saat Anda menggunakan aplikasi atau layanan kami (termasuk pendaftaran Kartu Tanda Anggota/KTA). <br><br> Dengan mendaftar, mengakses, atau menggunakan layanan kami, Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui seluruh ketentuan dalam Kebijakan Privasi ini.</p><h4>2. Informasi dan Data Pribadi yang Kami Kumpulkan</h4><p>Dalam mengelola keanggotaan, kami mengumpulkan beberapa kategori Data Pribadi, termasuk namun tidak terbatas pada:<ul><li>Data Identitas Diri: Nama lengkap, Nomor Induk Kependudukan (NIK), tempat/tanggal lahir, jenis kelamin, dan pas foto/KTP.</li><li>Data Kontak: Alamat email, nomor telepon/WhatsApp, dan alamat domisili.</li><li>Data Profesi/Pekerjaan: Nama instansi/sekolah tempat bekerja, jabatan/tugas, status kepegawaian, dan informasi wilayah/provinsi penugasan.</li><li>Data Teknis (Otomatis): Alamat IP (Internet Protocol), jenis peramban (browser), waktu akses, dan statistik penggunaan aplikasi untuk keperluan evaluasi sistem</li></ul></p><h4>3. Tujuan Penggunaan Data Pribadi</h4><p>Data Pribadi yang Anda berikan akan dikelola dan digunakan secara wajar sesuai dengan tujuan organisasi, yaitu untuk:<ul><li>Memproses pendaftaran, verifikasi, dan penerbitan Kartu Tanda Anggota (KTA).</li><li>Mengelola dan memperbarui basis data (database) anggota kepegawaian tata usaha/administrasi sekolah di tingkat nasional maupun wilayah.</li><li>Berkomunikasi dengan Anda terkait informasi organisasi, program kerja, musyawarah, dan pembaruan layanan.</li><li>Mencegah penipuan, penyalahgunaan, atau aktivitas ilegal lainnya dalam sistem kami.</li><li>Memenuhi kewajiban hukum atau peraturan perundang-undangan yang berlaku di Indonesia.</li></ul></p><h4>4. Pembagian dan Pengungkapan Data Pribadi Kami tidak akan menjual, menyewakan, atau menukar</h4><p>Data Pribadi Anda kepada pihak ketiga untuk tujuan komersial. Kami hanya dapat membagikan Data Pribadi Anda dalam kondisi berikut:<ul><li>Pengurus Internal: Hanya dapat diakses oleh admin pusat dan admin provinsi yang memiliki wewenang untuk keperluan verifikasi keanggotaan.</li><li>Penyedia Layanan (Pihak Ketiga): Pihak yang membantu kami mengoperasikan sistem (seperti layanan hosting atau Google Cloud/Drive yang digunakan sebagai infrastruktur aplikasi), yang terikat oleh kewajiban kerahasiaan.</li><li>Kewajiban Hukum: Jika diwajibkan oleh aparat penegak hukum, pengadilan, atau instansi pemerintah yang berwenang berdasarkan hukum Republik Indonesia.</li></ul></p><h4>5. Keamanan Data Pribadi</h4><p>Kami mengambil langkah-langkah teknis dan administratif yang wajar untuk melindungi Data Pribadi Anda dari akses, penggunaan, modifikasi, atau kebocoran yang tidak sah. Data Anda disimpan di dalam server/database yang dilindungi oleh protokol enkripsi dan sistem keamanan (termasuk enkripsi password menggunakan SHA-256). Namun, perlu diingat bahwa tidak ada transmisi data melalui internet yang 100% aman, sehingga kami mengimbau Anda untuk tetap menjaga kerahasiaan kredensial (username & password) Anda.</p><h4>6. Hak Anda sebagai Pemilik Data</h4><p>Sesuai dengan Undang-Undang yang berlaku, Anda memiliki hak penuh atas Data Pribadi Anda, meliputi:<ul><li>Hak untuk meminta akses dan salinan Data Pribadi Anda yang kami simpan.</li><li>Hak untuk memperbarui atau mengoreksi Data Pribadi yang tidak akurat (dapat diajukan melalui Admin Provinsi atau Admin Pusat).</li><li>Hak untuk meminta penghapusan Data Pribadi Anda jika Anda memutuskan untuk berhenti dari keanggotaan.</li></ul></p><h4>7. Penyimpanan dan Retensi Data</h4><p>Kami akan menyimpan Data Pribadi Anda selama Anda masih berstatus sebagai anggota aktif, atau selama diperlukan untuk memenuhi tujuan pengumpulan data sebagaimana disebutkan dalam kebijakan ini, serta untuk mematuhi kewajiban penyimpanan data berdasarkan hukum yang berlaku.</p><h4>8. Perubahan pada Kebijakan Privasi</h4><p>Organisasi berhak untuk mengubah, memodifikasi, atau memperbarui Kebijakan Privasi ini kapan saja untuk menyesuaikan dengan dinamika organisasi maupun peraturan hukum yang baru. Jika terjadi perubahan materiil, kami akan memberitahukan kepada anggota melalui pengumuman di aplikasi atau melalui kontak resmi.</p><h4>9. Hubungi Kami</h4><p>Jika Anda memiliki pertanyaan, keluhan, atau ingin menggunakan hak privasi Anda terkait Data Pribadi, silakan hubungi kami melalui:<ul><li>Helpdesk Admin Pusat: 0852 1990 1909</li><li>Email Resmi: atasindonesia.kab.tebo@gmail.com.</li></ul></p></div>'; Swal.fire({ title: 'Kebijakan Privasi', html: html, width: 600, confirmButtonText: 'Saya Mengerti', confirmButtonColor: '#4f46e5' }); }

function togglePasswordLogin() { var x = document.getElementById("p"); var i = document.getElementById("togglePass"); if (x.type === "password") { x.type = "text"; i.classList.replace('fa-eye', 'fa-eye-slash'); } else { x.type = "password"; i.classList.replace('fa-eye-slash', 'fa-eye'); } }
function togglePassVisibility(inputId, iconEl) { var x = document.getElementById(inputId); if (x.type === "password") { x.type = "text"; iconEl.classList.replace('fa-eye', 'fa-eye-slash'); } else { x.type = "password"; iconEl.classList.replace('fa-eye-slash', 'fa-eye'); } }

function doLogin(e) { 
    e.preventDefault(); showLoader(true); 
    apiCall('loginUser', { username: document.getElementById('u').value, password: document.getElementById('p').value }).then(function(res) { 
        showLoader(false); 
        if(res.status === 'success') { 
            appData.user = res; localStorage.setItem('atas_session', JSON.stringify(res)); notify('success', 'Berhasil Masuk', ''); res.role.includes('admin') ? renderAdmin() : renderMember(); 
        } else { Swal.fire('Gagal Login', res.message, 'error'); } 
    }).catch(function(err) { showLoader(false); Swal.fire('Error', err.message, 'error'); }); 
}

function doLogout() { Swal.fire({ title: 'Keluar?', text: "Sesi akan berakhir.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' }).then((r) => { if (r.isConfirmed) { localStorage.removeItem('atas_session'); appData.user = null; renderLogin(); } }); }

function loadProvinces(){ apiCall('getProvincesFromSheet').then(function(res){ var o='<option value="">Pilih...</option>'; res.forEach(p=>{ o+='<option value="'+p+'">'+p+'</option>'; }); if(document.getElementById('m_prov')) document.getElementById('m_prov').innerHTML=o; if(document.getElementById('s_prov')) document.getElementById('s_prov').innerHTML=o; if(document.getElementById('r_prov')) document.getElementById('r_prov').innerHTML=o; }).catch(e=>console.log(e)); }
function loadRegencies(provName, targetId, selectedVal){ if(!provName || provName === ""){ document.getElementById(targetId).innerHTML='<option>Pilih Prov</option>'; return; } document.getElementById(targetId).innerHTML='<option>Loading...</option>'; apiCall('getRegenciesFromSheet', {provName: provName}).then(function(res){ var o='<option value="">Pilih...</option>'; res.forEach(d=>{ var s = (selectedVal && selectedVal === d) ? 'selected' : ''; o+='<option value="'+d+'" '+s+'>'+d+'</option>'; }); document.getElementById(targetId).innerHTML=o; }).catch(e=>console.log(e)); }
function setProvDropdown(sid, n){ var s=document.getElementById(sid); if(!s || s.options.length <= 1) return null; for(var i=0;i<s.options.length;i++) if(s.options[i].value === n){ s.selectedIndex=i; return s.options[i].value; } return null; }

function switchTab(t){ document.getElementById('viewDash').className = 'hidden'; document.getElementById('viewData').className = 'hidden'; if(document.getElementById('viewSetting')) document.getElementById('viewSetting').className = 'hidden'; document.getElementById('mDash').className = 'menu-item'; document.getElementById('mData').className = 'menu-item'; if(document.getElementById('mSet')) document.getElementById('mSet').className = 'menu-item'; if(t === 'dash') { document.getElementById('viewDash').className = ''; document.getElementById('mDash').className = 'menu-item active'; loadDashboardStats(); } else if(t === 'data') { document.getElementById('viewData').className = ''; document.getElementById('mData').className = 'menu-item active'; } else if(t === 'setting') { document.getElementById('viewSetting').className = ''; document.getElementById('mSet').className = 'menu-item active'; } if(window.innerWidth <= 768) { var sb = document.querySelector('.sidebar'); if(sb && sb.classList.contains('active')) toggleSidebar(); } }
function loadData() { adminState.page = 1; fetchDataServer(); }
function handleSearch() { adminState.search = document.getElementById('sKey').value; adminState.fUnit = document.getElementById('fUnit').value; adminState.fStatus = document.getElementById('fStatus').value; adminState.fKab = document.getElementById('fKab').value; adminState.page = 1; fetchDataServer(); }
function changePage(delta) { var newPage = adminState.page + delta; if (newPage < 1) return; var maxPage = Math.ceil(adminState.totalData / adminState.limit); if (newPage > maxPage && maxPage > 0) return; adminState.page = newPage; fetchDataServer(); }

function fetchDataServer() { 
    var tbody = document.getElementById('tableBody'); 
    if(tbody) {
        clearInterval(tableLoaderInterval); var timer = 5;
        tbody.innerHTML = '<tr><td colspan="6" align="center" style="padding:40px 0;"><div class="spinner" style="width:40px;height:40px;margin:0 auto 15px"></div><div id="tableLoadText"><span style="font-weight:600; color:#4f46e5; font-size:14px;">Mengambil Data Anggota...</span><br><span style="font-size:28px; color:#ef4444; font-weight:900; display:block; margin-top:5px;">' + timer + '</span></div></td></tr>';
        tableLoaderInterval = setInterval(function() {
            timer--; var txtEl = document.getElementById('tableLoadText');
            if(txtEl) {
                if(timer > 0) { txtEl.innerHTML = '<span style="font-weight:600; color:#4f46e5; font-size:14px;">Mengambil Data Anggota...</span><br><span style="font-size:28px; color:#ef4444; font-weight:900; display:block; margin-top:5px;">' + timer + '</span>'; } 
                else { clearInterval(tableLoaderInterval); txtEl.innerHTML = '<span style="font-weight:600; color:#ea580c; font-size:14px;">Membaca Database Besar...</span><br><span style="font-size:12px; color:#64748b;">(Proses ini bisa makan waktu jika data ribuan)</span>'; }
            } else { clearInterval(tableLoaderInterval); }
        }, 1000);
    }
    
    document.getElementById('pageInfo').innerText = 'Loading...'; 
    var payload = { page: adminState.page, limit: adminState.limit, searchKey: adminState.search, filterUnit: adminState.fUnit, filterStatus: adminState.fStatus, filterKab: adminState.fKab };
    
    apiCall('getMembersPaged', payload).then(function(res){ 
        clearInterval(tableLoaderInterval); appData.members = res.data; adminState.totalData = res.total; renderTableServer(res.data); renderPaginationInfo(res); 
    }).catch(function(err){
        clearInterval(tableLoaderInterval); if(tbody) tbody.innerHTML = '<tr><td colspan="6" align="center" style="color:#ef4444; padding:20px; font-weight:bold;">Gagal mengambil data dari server. Silakan klik tombol Refresh.</td></tr>';
    }); 
}

function renderTableServer(data) { var b = document.getElementById('tableBody'); if(!b) return; var h = ''; if(data.length === 0) { h='<tr><td colspan="6" align="center" style="padding:20px;color:#999">Data Tidak Ditemukan</td></tr>'; } else { data.forEach((m, i) => { var color = '#f3f4f6'; var textColor = '#6b7280'; if(m.status_anggota=='AKTIF') { color='#dcfce7'; textColor='#16a34a'; } else if(m.status_anggota=='PENSIUN') { color='#e0e7ff'; textColor='#4338ca'; } else if(String(m.status_anggota).includes('NONAKTIF')) { color='#fee2e2'; textColor='#dc2626'; } else { color='#ffedd5'; textColor='#c2410c'; } h+='<tr><td><b style="color:#6366f1">'+m.id+'</b></td><td>'+m.nama+'</td><td>'+(m.kabupaten||'-')+'</td><td>'+(m.unit||'-')+'</td><td><span class="badge" style="background:'+color+';color:'+textColor+';padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">'+(m.status_anggota||'BELUM AKTIF')+'</span></td><td style="display: flex; flex-direction: column; gap: 5px; align-items: center;"><div style="display: flex; gap: 3px;"><button class="btn btn-sm btn-outline" type="button" onclick="viewDetail('+i+')" title="Lihat"><i class="fa fa-eye"></i></button><button class="btn btn-sm btn-outline" type="button" onclick="openAdminModal('+i+')" title="Edit"><i class="fa fa-edit"></i></button>'; if(m.link_kta) { h+='<a href="'+m.link_kta+'" target="_blank" class="btn btn-sm btn-green" title="Unduh KTA (PDF)" style="width: 100%; justify-content: center;"><i class="fa fa-download"></i> PDF</a>'; } h+='<button class="btn btn-sm btn-red" onclick="delMember(\''+m.nik+'\')" title="Hapus" style="width: 100%; justify-content: center;"><i class="fa fa-trash"></i></button></td></tr>'; }); } b.innerHTML = h; }
function renderPaginationInfo(res) { var start = (res.currentPage - 1) * 10 + 1; var end = start + res.data.length - 1; if(res.total === 0) { start = 0; end = 0; } document.getElementById('pageInfo').innerText = 'Hal ' + res.currentPage + ' / ' + res.totalPages + ' | Data: ' + start + '-' + end + ' dari ' + res.total; }

function loadDashboardStats() { apiCall('getDashboardStats').then(function(stats){ document.getElementById('stTot').innerText = stats.total; document.getElementById('stAct').innerText = stats.aktif; document.getElementById('stBelum').innerText = stats.belum; if(chartInstance) chartInstance.destroy(); var ctx = document.getElementById('cityChart'); if(ctx) { chartInstance=new Chart(ctx, { type:'bar', data:{ labels: Object.keys(stats.sebaran), datasets:[{ label:'Jumlah Anggota', data: Object.values(stats.sebaran), backgroundColor:'#4f46e5', borderRadius:5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins:{ legend:{display:false} } } }); } }).catch(e=>console.log(e)); }
function populateFilters() { apiCall('getFilterOptions').then(function(res){ var uHTML = '<option value="">Semua Unit</option>'; res.units.forEach(u => { uHTML += '<option value="'+u+'">'+u+'</option>'; }); document.getElementById('fUnit').innerHTML = uHTML; var kHTML = '<option value="">Semua Wilayah</option>'; res.kabs.forEach(k => { kHTML += '<option value="'+k+'">'+k+'</option>'; }); document.getElementById('fKab').innerHTML = kHTML; }).catch(e=>console.log(e)); }


function handleSaveSetting(e) { 
    e.preventDefault(); 
    Swal.fire({ title: 'Menyimpan...', text: 'Mohon tunggu', allowOutsideClick: false, didOpen:()=>{Swal.showLoading()} }); 
    
    var d = { 
        running: document.getElementById('set_running').value, 
        hp: document.getElementById('set_hp').value, 
        wa: document.getElementById('set_wa').value, 
        provinsi: document.getElementById('set_prov').value, 
        nama_admin_prov: document.getElementById('set_nama_admin').value 
    };

    apiCall('saveAppSettings', d).then(function(res){ 
        Swal.close(); 
        if(res.status === 'success') { 
            // Update cache lokal browser agar tidak perlu refresh penuh
            appData.settings.running = d.running; 
            appData.settings.hp = d.hp; 
            appData.settings.wa = d.wa; 
            appData.settings.provinsi_default = d.provinsi; 
            appData.settings.nama_admin_prov = d.nama_admin_prov; 
            
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengaturan Lokal disimpan!', timer: 1500, showConfirmButton: false }).then(() => { 
                renderAdmin(); switchTab('dash'); 
            }); 
        } else { 
            Swal.fire('Gagal', res.message, 'error'); 
        } 
    }).catch(err => Swal.fire('Error', err.message, 'error')); 
}

function exportExcel() { 
    var currentSearch = adminState.search; var currentUnit = adminState.fUnit; var currentStatus = adminState.fStatus; var currentKab = adminState.fKab; 
    Swal.fire({ title: 'Menyiapkan Data', text: 'Server sedang merangkum data excel Anda...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } }); 
    
    apiCall('generateExportExcelUrl', {searchKey: currentSearch, filterUnit: currentUnit, filterStatus: currentStatus, filterKab: currentKab}).then(function(res) { 
        if (res.status === 'empty') { Swal.fire('Info', 'Tidak ada data yang sesuai dengan filter pencarian Anda.', 'info'); } 
        else if (res.status === 'success') { Swal.close(); window.location.href = res.url; } 
        else { Swal.fire('Error', res.message, 'error'); }
    }).catch(err => Swal.fire('Error', err.message, 'error')); 
}

function toggleSidebar() { var sb = document.querySelector('.sidebar'); var overlay = document.getElementById('sidebarOverlay'); if (!overlay) { overlay = document.createElement('div'); overlay.id = 'sidebarOverlay'; overlay.className = 'sidebar-overlay'; overlay.onclick = function() { toggleSidebar(); }; document.body.appendChild(overlay); } sb.classList.toggle('active'); overlay.classList.toggle('active'); }

function handleManualRefresh() { 
    if (!appData.user) { notify('warning', 'Silakan login terlebih dahulu', ''); return; } showLoader(true); 
    if (appData.user.role.includes('admin')) { 
        apiCall('getMembersPaged', { page: adminState.page, limit: adminState.limit, searchKey: adminState.search, filterUnit: adminState.fUnit, filterStatus: adminState.fStatus, filterKab: adminState.fKab }).then(function(res) { 
            appData.members = res.data; adminState.totalData = res.total; renderTableServer(res.data); renderPaginationInfo(res); loadDashboardStats(); showLoader(false); notify('success', 'Data Diperbarui', ''); 
        }).catch(err => { showLoader(false); Swal.fire('Gagal',err.message,'error'); }); 
    } else { 
        apiCall('loginUser', { username: appData.user.data.id, password: appData.user.data.password }).then(function(res) { 
            showLoader(false); if(res.status === 'success') { appData.user = res; localStorage.setItem('atas_session', JSON.stringify(res)); renderMember(); notify('success', 'Profil Diperbarui', ''); } 
        }).catch(err => showLoader(false)); 
    } 
}

function openAdminProfile() { 
    var u = appData.user.data; 
    document.getElementById('adm_row').value = u.row_index; 
    document.getElementById('adm_user').value = u.username; 
    
    document.getElementById('adm_pass').value = ""; 
    document.getElementById('adm_pass').placeholder = "Ketik password baru/lama di sini..."; 
    
    document.getElementById('adm_name').value = u.nama; 
    openModal('adminProfileModal'); 
}

function handleAdminProfileSave(e) { 
    e.preventDefault(); var d = { row_index: document.getElementById('adm_row').value, username: document.getElementById('adm_user').value, password: document.getElementById('adm_pass').value, nama: document.getElementById('adm_name').value }; closeModalKTA('adminProfileModal'); showLoader(true); 
    apiCall('updateAdminAccount', d).then(function(res) { 
        showLoader(false); if(res.status === 'success') { Swal.fire({ title: 'Sukses', text: res.message, icon: 'success', timer:1500, showConfirmButton:false }); appData.user.data.username = d.username; appData.user.data.password = d.password; appData.user.data.nama = d.nama; renderAdmin(); } else { Swal.fire('Gagal', res.message, 'error'); } 
    }).catch(err => { showLoader(false); Swal.fire('Error', err.message, 'error'); }); 
}

function openAdminModal(idx) { openModal('adminModal'); document.getElementById('formMember').reset(); document.getElementById('m_crop_container').style.display = 'none'; document.getElementById('m_preview_final').innerHTML = ""; document.getElementById('m_base64').value = ""; var isSuper = (appData.user && (appData.user.role === 'superadmin' || appData.user.role === 'super')); const superFields = document.getElementById('superAdminFields'); if (superFields) { if (isSuper) { superFields.classList.remove('hidden'); superFields.style.display = 'block'; } else { superFields.classList.add('hidden'); superFields.style.display = 'none'; } } var s = (id,v) => { var e=document.getElementById(id); if(e) e.value=v||''; }; if(idx !== undefined) { var d = appData.members[idx]; s('m_row',d.row_index); s('m_curFoto',d.foto); s('m_linkKta',d.link_kta); s('m_id',d.id); s('m_nik',d.nik); s('m_nama',d.nama); s('m_gelarD',d.gelar_depan); s('m_gelarB',d.gelar_belakang); s('m_jk',d.jk); s('m_agama', d.agama); s('m_tmpLahir',d.tempat_lahir); s('m_tglLahir',d.tgl_lahir); s('m_hp',d.hp); s('m_email',d.email); s('m_pass',d.password); s('m_alamat',d.alamat); s('m_unit',d.unit); s('m_jabatan',d.jabatan); s('m_statPeg',d.status_pegawai); s('m_statSek',d.status_sekolah); s('m_status',d.status_anggota||'BELUM AKTIF'); s('m_nia',d.nia_lengkap); s('m_pend', d.pendidikan); s('m_jabOrg', d.jabatan_org); s('m_masaKta',d.masa_kta); s('m_jenjang', d.jenjang); s('m_mulai', d.mulai_tugas); s('m_tingkat', d.tingkat_pengurus); s('m_ad', d.kode_ad); s('m_ae', d.kode_ae); s('m_af', d.kode_af); if(isSuper){ updateStatusAuto(); } var provId = setProvDropdown('m_prov', d.provinsi); loadRegencies(provId, 'm_kab', d.kabupaten); if(d.foto) document.getElementById('m_preview_final').innerHTML='<img src="'+getImageUrl(d.foto)+'" style="height:100px;border-radius:6px">'; } else { s('m_row',''); if(appData.settings.provinsi_default){ setTimeout(function(){ var p=setProvDropdown('m_prov',appData.settings.provinsi_default); if(p) loadRegencies(p,'m_kab'); },500); } } }
function updateStatusAuto() { var ad = document.getElementById('m_ad').value || ""; var ae = document.getElementById('m_ae').value || ""; var af = document.getElementById('m_af').value || ""; var tgl = document.getElementById('m_tglLahir').value; var tglStr = ""; if(tgl) { var parts = tgl.split('-'); var y = parts[0]; var m = parts[1]; var d = parts[2]; tglStr = y + m + d; var masaKtaYear = parseInt(y) + 58; var masaKtaFull = masaKtaYear + '-' + m + '-' + d; document.getElementById('m_masaKta').value = masaKtaFull; } var niaPreview = ae + af + tglStr + ad; document.getElementById('m_ag').value = niaPreview; document.getElementById('m_nia').value = niaPreview; var currentStatus = document.getElementById('m_status').value; if (currentStatus !== "PENSIUN" && currentStatus !== "NONAKTIF/MUTASI") { if (ae !== "" && af !== "" && ad !== "") { document.getElementById('m_status').value = "AKTIF"; } else { document.getElementById('m_status').value = "BELUM AKTIF"; } } }

function handleSave(e) { 
    e.preventDefault(); showLoader(true); 
    var val = function(id) { var el = document.getElementById(id); if(!el) return ""; if(el.type === 'select-one' && el.selectedIndex > 0) return el.options[el.selectedIndex].text; return el.value; }; 
    var d={ row_index: document.getElementById('m_row').value, id_anggota: document.getElementById('m_id').value, nik:val('m_nik'), nama:val('m_nama'), gelar_depan:val('m_gelarD'), gelar_belakang:val('m_gelarB'), jk:val('m_jk'), agama:val('m_agama'), tempat_lahir:val('m_tmpLahir'), tgl_lahir:document.getElementById('m_tglLahir').value, hp:val('m_hp'), email:val('m_email'), password:val('m_pass'), alamat:val('m_alamat'), unit:val('m_unit'), jabatan:val('m_jabatan'), status_sekolah:val('m_statSek'), status_pegawai:val('m_statPeg'), provinsi:val('m_prov'), kabupaten:val('m_kab'), status_anggota: document.getElementById('m_status').value, nia_lama:val('m_nia'), masa_kta: document.getElementById('m_masaKta').value, pendidikan: val('m_pend'), jabatan_org: val('m_jabOrg'), tingkat_pengurus: val('m_tingkat'), link_kta:val('m_linkKta'), jenjang:val('m_jenjang'), mulai_tugas:val('m_mulai'), current_foto:document.getElementById('m_curFoto').value, foto_file_base64:document.getElementById('m_base64').value, kode_ad: document.getElementById('m_ad').value, kode_ae: document.getElementById('m_ae').value, kode_af: document.getElementById('m_af').value }; 
    closeModalKTA('adminModal'); 
    apiCall('saveMemberData', d).then(res => { 
        showLoader(false); if(res.status === 'success') { notify('success','Berhasil', res.message); fetchDataServer(); loadDashboardStats(); } else { Swal.fire('Error', res.message, 'error'); } 
    }).catch(err => { showLoader(false); Swal.fire('Error System', err.message, 'error'); }); 
}

function handleManualCrop(event, targetAreaId, previewId) { var file = event.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function(e) { var areaEl = document.getElementById(targetAreaId); areaEl.parentElement.style.display = 'block'; document.getElementById(previewId).innerHTML = '<p style="color:orange; font-size:11px">Sedang memproses crop...</p>'; if (activeCroppie) activeCroppie.destroy(); activeCroppie = new Croppie(areaEl, { viewport: { width: 150, height: 200, type: 'square' }, boundary: { width: 250, height: 300 }, showZoomer: true, enableOrientation: true }); activeCroppie.bind({ url: e.target.result }); }; reader.readAsDataURL(file); }
function executeCrop(areaId, hiddenInputId, containerId, previewId) { if (!activeCroppie) return; activeCroppie.result({ type: 'base64', size: { width: 600, height: 800 }, format: 'jpeg', quality: 0.8 }).then(function(base64) { document.getElementById(hiddenInputId).value = base64; document.getElementById(containerId).style.display = 'none'; document.getElementById(previewId).innerHTML = '<img src="'+base64+'" style="width:100px; height:133px; border-radius:8px; border:2px solid #4f46e5; object-fit:cover">'; notify('success', 'Foto berhasil dikunci', ''); activeCroppie.destroy(); activeCroppie = null; }); }
function openSelfEdit() { document.getElementById('s_crop_container').style.display = 'none'; document.getElementById('s_base64').value = ""; document.getElementById('s_preview_final').innerHTML = ""; openModal('selfEditModal'); var u = appData.user.data; var s = (id,v) => { var e=document.getElementById(id); if(e) e.value=v||''; }; s('s_row',u.row_index); s('s_curFoto',u.foto); s('s_hp',u.hp); s('s_tmpLahir', u.tempat_lahir); s('s_tglLahir', u.tgl_lahir); s('s_email',u.email); s('s_jk',u.jk); s('s_agama', u.agama); s('s_pend',u.pendidikan); s('s_unit',u.unit); s('s_statSek',u.status_sekolah); s('s_jabatan',u.jabatan); s('s_statPeg',u.status_pegawai); s('s_alamat',u.alamat); s('s_jenjang',u.jenjang); s('s_mulai',u.mulai_tugas); document.getElementById('s_base64').value=""; var provId = setProvDropdown('s_prov', u.provinsi); loadRegencies(provId, 's_kab', u.kabupaten); if(u.foto) document.getElementById('s_preview_final').innerHTML='<img src="'+getImageUrl(u.foto)+'" style="height:133px;width:100px;object-fit:cover;border-radius:8px;border:2px solid #eee">'; }

function handleSelfSave(e){ 
    e.preventDefault(); showLoader(true); 
    var val=id=>document.getElementById(id).type==='select-one'&&document.getElementById(id).selectedIndex>0?document.getElementById(id).options[document.getElementById(id).selectedIndex].text:document.getElementById(id).value; 
    var d={ 
        row_index:val('s_row'), hp:val('s_hp'), email:val('s_email'), tgl_lahir:val('s_tglLahir'), 
        tempat_lahir:val('s_tmpLahir'), jk:val('s_jk'), agama:val('s_agama'), pendidikan:val('s_pend'), 
        provinsi:val('s_prov'), kabupaten:val('s_kab'), unit:val('s_unit'), jabatan:val('s_jabatan'), 
        status_pegawai:val('s_statPeg'), 
        status_sekolah:val('s_statSek'),
        alamat:val('s_alamat'), jenjang:val('s_jenjang'), mulai_tugas:val('s_mulai'), 
        current_foto:val('s_curFoto'), foto_file_base64:val('s_base64') 
    }; 
    closeModalKTA('selfEditModal'); 
    apiCall('updateMemberProfile', d).then(res=>{ 
        showLoader(false); if(res.status==='success'){ notify('success','Profil Diupdate',''); appData.user.data=res.data; localStorage.setItem('atas_session', JSON.stringify(appData.user)); renderMember(); } else Swal.fire('Gagal', res.message, 'error'); 
    }).catch(err => { showLoader(false); Swal.fire('Error', err.message, 'error'); }); 
}

function delMember(nik) { 
    if(!nik || nik === "undefined") { Swal.fire('Error', 'Data NIK tidak valid', 'error'); return; }
    var targetMember = appData.members.find(m => String(m.nik).replace(/'/g, "") === String(nik).replace(/'/g, ""));
    var namaAnggota = targetMember ? targetMember.nama : "Nama Tidak Diketahui";
    Swal.fire({ title: 'Hapus Data?', text: "Yakin ingin menghapus NIK: " + nik + " (" + namaAnggota + ")?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' }).then((result) => { 
        if(result.isConfirmed) { 
            appData.members = appData.members.filter(m => String(m.nik).replace(/'/g, "") !== String(nik).replace(/'/g, ""));
            renderTableServer(appData.members); Swal.fire({icon: 'success', title: 'Dihapus!', text: 'Data lenyap seketika.', timer: 1500, showConfirmButton: false});
            apiCall('deleteMember', {nikAnggota: nik}).then(function(res){ 
                if(res === 'OK') { loadDashboardStats(); } else { fetchDataServer(); Swal.fire('Info', 'Gagal hapus di server: ' + res, 'warning'); }
            }).catch(err => Swal.fire('Error', err.message, 'error')); 
        } 
    }); 
}

function resetPass(){ var r = document.getElementById('m_row').value; if(!r || r === "") { Swal.fire('Eits!', 'Simpan dulu data baru.', 'warning'); return; } Swal.fire({ title: 'Reset Password?', text: "Password akan jadi '123456' dan tampil di form.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' }).then((result) => { if(result.isConfirmed){ showLoader(true); apiCall('resetPassword', {rowIndex: r}).then(res => { showLoader(false); if(res === 'SUKSES') { document.getElementById('m_pass').value = "123456"; Swal.fire({ icon:'success', title:'Berhasil', text:'Password kini: 123456', timer:2000, showConfirmButton:false }); fetchDataServer(); } else Swal.fire('Gagal', res, 'error'); }).catch(err => { showLoader(false); Swal.fire('Error', err.message, 'error'); }); } }); }
function openChangePass() { openModal('passModal'); }
function handlePassChange(e) { e.preventDefault(); var oldP = document.getElementById('cp_old').value; var newP = document.getElementById('cp_new').value; var r = appData.user.data.row_index; closeModalKTA('passModal'); showLoader(true); apiCall('changeOwnPassword', {cp_row: r, cp_old: oldP, cp_new: newP}).then(res => { showLoader(false); if(res.status === 'success') { Swal.fire({ icon:'success', title:'Sukses', text:'Password berhasil diubah!', timer:2000, showConfirmButton:false }); } else { Swal.fire('Gagal', res.message, 'error'); } }).catch(err => { showLoader(false); Swal.fire('Error', err.message, 'error'); }); }

function generateKTA() {
    var d = currentDetailMember;
    if (!d) return Swal.fire('Error', 'Pilih anggota', 'error');
    showLoader(true, 'MEMBUAT KTA DIGITAL...');

    const loadImage = (src) => {
        return new Promise((resolve) => {
            if (!src) return resolve(null); const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
        });
    };

    apiCall('getKtaResources', {photoUrl: d.foto, logoUrl: appData.settings.logo}).then(async function(assets) {
        try { await document.fonts.load("bold 21px Oswald"); } catch(e) { console.log(e); }
        const [bgImg, logoImg, photoImg] = await Promise.all([ loadImage(assets.bg), loadImage(assets.logo), loadImage(assets.photo) ]);
        var canvas = document.getElementById('ktaCanvas'); var ctx = canvas.getContext('2d');
        
        if (bgImg) { 
            ctx.drawImage(bgImg, 0, 0, 600, 380); 
        } else { 
            var grd = ctx.createLinearGradient(0, 0, 600, 0); 
            grd.addColorStop(0, "#4f46e5"); grd.addColorStop(1, "#7c3aed"); 
            ctx.fillStyle = grd; ctx.fillRect(0, 0, 600, 380); 
        }

        var nama = d.nama.length > 30 ? d.nama.substring(0, 30) + "..." : d.nama; 
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 0; ctx.fillStyle = "black"; ctx.font = "bold 21px Oswald"; 
        var leftX = 160; var topY = 160; 
        ctx.fillText("N I A      : " + (d.nia_lengkap || "-"), leftX, topY); 
        ctx.fillText("Nama     : " + nama, leftX, topY + 28); 
        ctx.fillText("Instansi : " + (d.unit || "-"), leftX, topY + 56); 
        ctx.fillText("Provinsi : " + (d.provinsi || "-"), leftX, topY + 84);

        var baseUrl = window.location.origin + window.location.pathname;
        var verifyUrl = baseUrl + "?verify=" + encodeURIComponent(d.nia_lengkap);

        var qr = new QRious({ value: verifyUrl, size: 250, level: 'H' }); 
        const qrImg = await loadImage(qr.toDataURL());
        
        if (qrImg) { 
            ctx.fillStyle = "white"; 
            ctx.fillRect(9, 277, 96, 96); 
            ctx.drawImage(qrImg, 9, 277, 96, 96); 

            if (logoImg) {
                var qrCenterX = 9 + (96 / 2);
                var qrCenterY = 277 + (96 / 2);
                var logoSize = 22; 
                var bgSize = 23;   
                ctx.fillStyle = "white";
                ctx.fillRect(qrCenterX - (bgSize/2), qrCenterY - (bgSize/2), bgSize, bgSize);
                ctx.drawImage(logoImg, qrCenterX - (logoSize/2), qrCenterY - (logoSize/2), logoSize, logoSize);
            }
        }

        var photoX = 25; var photoY = 120; var fixedHeight = 132; var fixedWidth = 99; 
        if (photoImg) { 
            var ratio = photoImg.width / photoImg.height; var newWidth = fixedHeight * ratio; 
            ctx.lineWidth = 5; ctx.strokeStyle = "white"; ctx.strokeRect(photoX, photoY, newWidth, fixedHeight); 
            ctx.drawImage(photoImg, photoX, photoY, newWidth, fixedHeight); 
        } else { 
            ctx.fillStyle = "#cbd5e1"; ctx.fillRect(photoX, photoY, fixedWidth, fixedHeight); 
            ctx.fillStyle = "#64748b"; ctx.font = "12px Arial"; ctx.fillText("No Foto", photoX + 25, photoY + 70); 
        }

        showLoader(false); openModal('ktaGenModal');
        var btnDownload = document.getElementById('downloadKtaBtn'); btnDownload.href = canvas.toDataURL("image/png");
        var namaAman = (d.nama || "Anggota").replace(/[^a-zA-Z0-9]/g, "_"); btnDownload.download = "KTA_Digital_" + namaAman + ".png";
    }).catch(function(err) { showLoader(false); Swal.fire("Gagal", "Koneksi lambat/Error Server: " + err.message, "error"); });
}

function checkAndOpenKta(m) { if(!m) m = currentDetailMember; if(isNiaComplete(m)) { currentDetailMember = m; generateKTA(); } else { Swal.fire({ icon: 'warning', title: 'Akses Ditolak', text: 'Anggota ini belum memiliki NIA lengkap.' }); } }
function checkAndDownloadBg(m) { if(!m) m = currentDetailMember; if(isNiaComplete(m)) { downloadBackground(); } else { Swal.fire({ icon: 'warning', title: 'Akses Ditolak', text: 'Anggota ini belum memiliki NIA lengkap.' }); } }
function isNiaComplete(m) { if (m && m.kode_ad && m.kode_ae && m.kode_af && m.nia_lengkap && m.nia_lengkap.length > 5) { return true; } return false; }

function downloadBackground() { 
    showLoader(true, 'MENYIAPKAN GAMBAR BELAKANG...'); 
    apiCall('getBackBackgroundBase64').then(function(base64Data){ 
        showLoader(false); 
        if(base64Data && base64Data.length > 50) { 
            var link = document.createElement('a'); link.href = base64Data; link.download = "KTA_Belakang_" + (appData.user.data.nama || "Anggota") + ".png"; 
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Gambar KTA Belakang sudah diunduh.', timer: 2000, showConfirmButton: false });
        } else { Swal.fire('Gagal', 'Gambar Background Belakang belum disetting.', 'error'); } 
    }).catch(function(err){ showLoader(false); Swal.fire('Error', err.message, 'error'); }); 
}

function validateTwoDigit(el) { let val = el.value.replace(/[^0-9]/g, ''); if (val.length > 2) { Swal.fire('Format Salah', 'Kode Wilayah maksimal 2 digit angka.', 'warning'); el.value = ""; } else if (val.length === 1) { el.value = '0' + val; } else { el.value = val; } updateStatusAuto(); }
function validateFourDigit(el) { let val = el.value.replace(/[^0-9]/g, ''); if (val.length > 4) { Swal.fire('Format Salah', 'Nomor Urut maksimal 4 digit angka.', 'warning'); el.value = ""; } else if (val.length > 0 && val.length < 4) { el.value = val.padStart(4, '0'); } else { el.value = val; } updateStatusAuto(); }
function sanitizeNumber(el) { el.value = el.value.replace(/[^0-9]/g, ''); updateStatusAuto(); }

function openContactPopup() {
    var s = appData.settings || {}; 
    var hp = String(s.hp || ''); 
    var web = String(s.web || ''); 
    var email = String(s.email || '');

    var htmlBtns = '<div style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">';
    
    if(hp && hp.length > 3) {
        var cleanNumber = hp.replace(/[^0-9]/g, ''); 
        var waNumber = cleanNumber; 
        if (waNumber.startsWith('0')) { waNumber = '62' + waNumber.substring(1); }
        var telNumber = cleanNumber; 
        if (waNumber.startsWith('62')) { telNumber = '+' + waNumber; }
        
        htmlBtns += '<a href="https://wa.me/'+waNumber+'" target="_blank" class="btn btn-green" style="width:100%; justify-content:center; padding:12px;"><i class="fab fa-whatsapp" style="font-size:18px;"></i> WA Admin Pusat</a>';
        htmlBtns += '<button onclick="window.location.href=\'tel:'+telNumber+'\'" class="btn btn-orange" style="width:100%; justify-content:center; padding:12px; border:none; cursor:pointer; font-family:inherit;"><i class="fa fa-phone" style="font-size:18px;"></i> Telepon Bantuan</button>';
    }
    
    if(web && web.length > 3) { 
        var webUrl = web.startsWith('http') ? web : 'https://' + web; 
        htmlBtns += '<a href="'+webUrl+'" target="_blank" class="btn btn-primary" style="width:100%; justify-content:center; padding:12px;"><i class="fa fa-globe" style="font-size:18px;"></i> Website Resmi</a>'; 
    }
    
    if(email && email.length > 3) { 
        htmlBtns += '<button onclick="window.location.href=\'mailto:'+email+'\'" class="btn btn-outline" style="width:100%; justify-content:center; padding:12px; border-color:#e2e8f0; cursor:pointer; font-family:inherit;"><i class="fa fa-envelope" style="font-size:18px;"></i> Email Kami</button>'; 
    }
    
    if(hp.length < 4 && web.length < 4 && email.length < 4) { 
        htmlBtns += '<p style="color:red; font-size:13px;">Maaf, kontak admin belum diatur.</p>'; 
    }
    
    htmlBtns += '</div>';
    Swal.fire({ title: 'Hubungi Kami', text: 'Pilih saluran bantuan di bawah ini:', html: htmlBtns, showConfirmButton: false, showCloseButton: true });
}

function renderValidationPage(nia) {
    showLoader(true, "MEMVALIDASI KTA...");
    
    apiCall('verifyKta', { nia: nia }).then(function(res) {
        showLoader(false);
        var appDiv = document.getElementById('app');
        appDiv.classList.remove('hidden');

        if(res.valid) {
            var d = res.data;
            window.tempPublicMember = d;
            window.tempPublicLogo = res.orgLogo;

            var stColor = d.status === 'AKTIF' ? 'color:#16a34a; background:#dcfce7;' : (String(d.status).includes('NONAKTIF') ? 'color:#dc2626; background:#fee2e2;' : 'color:#c2410c; background:#ffedd5;');
            var cleanLogo = getImageUrl(res.orgLogo);
            var cleanFoto = getImageUrl(d.foto);
            var homeUrl = window.location.origin + window.location.pathname;

            var html = `
            <style>
                .val-bottom-bar { display: none; }
                .val-org-short { margin:0; font-family:'Poppins', sans-serif; color:var(--text-dark); font-weight:800; font-size:22px; }
                .val-org-long { margin:0; font-size:11px; color:var(--text-gray); font-weight:500; line-height:1.3; text-transform:uppercase; }
                
                @media (max-width: 768px) {
                    .val-btn-desktop { display: none !important; }
                    .val-bottom-bar {
                        display: flex; position: fixed; bottom: 0; left: 0; right: 0; width: 100%; height: 75px;
                        background: white; align-items: center; justify-content: space-between;
                        box-shadow: 0 -4px 20px rgba(0,0,0,0.08); z-index: 9999;
                    }
                    .val-nav-item {
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        color: #64748b; font-size: 10px; cursor: pointer; font-weight: 600; transition: 0.2s;
                    }
                    .val-nav-item i { font-size: 22px; margin-bottom: 4px; }
                    .val-nav-item:active { color: #4f46e5; }
                    .val-nav-left { width: 20%; }
                    .val-nav-right { width: 20%; }
                    .val-nav-center { width: 60%; display: flex; justify-content: center; }
                    
                    .btn-val-center {
                        background: linear-gradient(135deg, #10b981, #059669); color: white;
                        border: none; padding: 13px 0; width: 92%; border-radius: 30px;
                        font-weight: 700; font-size: 14px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
                        display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
                    }
                    .btn-val-center:active { transform: scale(0.95); }
                    .val-container { padding-bottom: 95px !important; }
                }
            </style>

            <div class="val-container" style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--bg-body); padding:20px;">
                <div class="glass-card" style="margin-top:0; padding:30px; text-align:center; max-width:400px; width:100%; background:white; border-radius:20px; box-shadow:0 10px 25px rgba(0,0,0,0.1); animation: slideUp 0.5s ease-out;">
                    
                    <img src="${cleanLogo}" onerror="this.src='https://via.placeholder.com/100?text=LOGO';" style="height:65px; object-fit:contain; margin-bottom:10px;">
                    <h3 class="val-org-short">${res.orgShort || 'ATAS INDONESIA'}</h3>
                    <p class="val-org-long">${res.orgName}</p>
                    
                    <div style="margin:20px 0; padding:15px; border-radius:12px; background:#f0fdf4; border:1px solid #bbf7d0;">
                        <i class="fa fa-check-circle" style="color:#16a34a; font-size:45px; margin-bottom:10px;"></i>
                        <h4 style="margin:0; color:#166534; font-family:'Poppins', sans-serif;">KTA SAH & TERVALIDASI</h4>
                    </div>
                    
                    <img src="${cleanFoto}" style="width:110px; height:146px; object-fit:cover; border-radius:10px; border:3px solid #e2e8f0; margin-bottom:20px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">

                    <div style="text-align:left; font-size:13px; color:var(--text-dark); background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
                        <div style="padding:8px 0; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between;">
                            <b style="color:var(--text-gray)">NIA</b> <span style="color:#4f46e5; font-weight:800; text-align:right;">${d.nia}</span>
                        </div>
                        <div style="padding:8px 0; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between;">
                            <b style="color:var(--text-gray)">Nama</b> <span style="font-weight:600; text-align:right; max-width:65%;">${d.nama}</span>
                        </div>
                        <div style="padding:8px 0; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between;">
                            <b style="color:var(--text-gray)">Tgl Lahir</b> <span style="text-align:right;">${d.tgl_lahir}</span>
                        </div>
                        <div style="padding:8px 0; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between;">
                            <b style="color:var(--text-gray)">Gender</b> <span style="text-align:right;">${d.jk}</span>
                        </div>
                        <div style="padding:8px 0; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between;">
                            <b style="color:var(--text-gray)">Unit Kerja</b> <span style="text-align:right; max-width:60%;">${d.unit}</span>
                        </div>
                        <div style="padding:8px 0; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between;">
                            <b style="color:var(--text-gray)">Jabatan Org</b> <span style="text-align:right; max-width:60%;">${d.jabatan_org}</span>
                        </div>
                        <div style="padding:8px 0; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between;">
                            <b style="color:var(--text-gray)">Tingkat</b> <span style="text-align:right; max-width:60%;">${d.tingkat_pengurus}</span>
                        </div>
                        <div style="padding:8px 0; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between;">
                            <b style="color:var(--text-gray)">Kab/Kota</b> <span style="text-align:right;">${d.kabupaten}</span>
                        </div>
                        <div style="padding:8px 0; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between;">
                            <b style="color:var(--text-gray)">Provinsi</b> <span style="text-align:right;">${d.provinsi}</span>
                        </div>
                        
                        <div style="padding-top:15px; text-align:center;">
                            <div style="font-size:11px; color:var(--text-gray); font-weight:bold; margin-bottom:5px;">STATUS ANGGOTA</div>
                            <span style="padding:6px 15px; border-radius:20px; font-weight:800; font-size:13px; letter-spacing:0.5px; ${stColor}">${d.status}</span>
                        </div>
                    </div>
                    
                    <div class="val-btn-desktop">
                        <br>
                        <button onclick="generatePublicKTA()" class="btn btn-green" style="width:100%; justify-content:center; margin-bottom:10px;"><i class="fa fa-id-badge"></i> Lihat KTA Digital</button>
                        <button onclick="window.location.href = '${homeUrl}'" class="btn btn-outline" style="width:100%; justify-content:center;"><i class="fa fa-home"></i> Kembali ke Beranda</button>
                    </div>
                </div>
            </div>

            <div class="val-bottom-bar">
                <div class="val-nav-item val-nav-left" onclick="window.location.href = '${homeUrl}'">
                    <i class="fa fa-home"></i>
                    <span>Beranda</span>
                </div>
                
                <div class="val-nav-center">
                    <button class="btn-val-center" onclick="generatePublicKTA()">
                        <i class="fa fa-id-badge"></i> KTA Digital
                    </button>
                </div>
                
                <div class="val-nav-item val-nav-right" onclick="handleCloseValidation()">
                    <i class="fa fa-times-circle" style="color:#ef4444;"></i>
                    <span>Tutup</span>
                </div>
            </div>
            `;
            appDiv.innerHTML = html;
        } else {
            var homeUrl = window.location.origin + window.location.pathname;
            var html = `
            <div style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--bg-body); padding:20px;">
                <div class="glass-card" style="margin-top:0; padding:30px; text-align:center; max-width:400px; width:100%; background:white; border-radius:20px; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
                    <i class="fa fa-times-circle" style="color:#ef4444; font-size:70px; margin-bottom:15px;"></i>
                    <h3 style="margin:0 0 10px 0; font-family:'Poppins', sans-serif; color:var(--text-dark);">KTA Tidak Dikenali</h3>
                    <p style="color:var(--text-gray); font-size:14px; margin-bottom:25px;">Maaf, data KTA ini tidak terdaftar, tidak valid, atau telah dihapus dari sistem keanggotaan kami.</p>
                    
                    <button onclick="window.location.href = '${homeUrl}'" class="btn btn-primary" style="width:100%; justify-content:center;"><i class="fa fa-home"></i> Kembali ke Beranda</button>
                </div>
            </div>
            `;
            appDiv.innerHTML = html;
        }
    }).catch(function(err) {
        showLoader(false);
        Swal.fire('Error API', 'Gagal memvalidasi QR: ' + err.message, 'error');
    });
}

function handleCloseValidation() {
    Swal.fire({
        title: 'Tutup Halaman?',
        text: "Anda akan keluar dari halaman validasi ini.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Tutup',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            window.close();
            setTimeout(function() {
                var homeUrl = window.location.origin + window.location.pathname;
                window.location.href = homeUrl;
            }, 300);
        }
    });
}

function generatePublicKTA() {
    var d = window.tempPublicMember;
    if (!d) return Swal.fire('Error', 'Data anggota tidak tersedia', 'error');
    
    showLoader(true, 'MEMBUAT KTA DIGITAL...');

    const loadImage = (src) => {
        return new Promise((resolve) => {
            if (!src) return resolve(null); const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
        });
    };

    apiCall('getKtaResources', {photoUrl: d.foto, logoUrl: window.tempPublicLogo}).then(async function(assets) {
        try { await document.fonts.load("bold 21px Oswald"); } catch(e) { console.log(e); }
        const [bgImg, logoImg, photoImg] = await Promise.all([ loadImage(assets.bg), loadImage(assets.logo), loadImage(assets.photo) ]);
        
        var canvas = document.getElementById('ktaCanvas'); 
        var ctx = canvas.getContext('2d');
        
        if (bgImg) { 
            ctx.drawImage(bgImg, 0, 0, 600, 380); 
        } else { 
            var grd = ctx.createLinearGradient(0, 0, 600, 0); grd.addColorStop(0, "#4f46e5"); grd.addColorStop(1, "#7c3aed"); ctx.fillStyle = grd; ctx.fillRect(0, 0, 600, 380); 
        }

        var nama = d.nama.length > 30 ? d.nama.substring(0, 30) + "..." : d.nama; 
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 0; ctx.fillStyle = "black"; ctx.font = "bold 21px Oswald"; 
        var leftX = 160; var topY = 160; 
        ctx.fillText("N I A      : " + (d.nia || "-"), leftX, topY); 
        ctx.fillText("Nama     : " + nama, leftX, topY + 28); 
        ctx.fillText("Instansi : " + (d.unit || "-"), leftX, topY + 56); 
        ctx.fillText("Provinsi : " + (d.provinsi || "-"), leftX, topY + 84);

        var baseUrl = window.location.origin + window.location.pathname;
        var verifyUrl = baseUrl + "?verify=" + encodeURIComponent(d.nia);
        var qr = new QRious({ value: verifyUrl, size: 250, level: 'H' }); 
        const qrImg = await loadImage(qr.toDataURL());

        if (qrImg) { 
            ctx.fillStyle = "white"; 
            ctx.fillRect(9, 277, 96, 96); 
            ctx.drawImage(qrImg, 9, 277, 96, 96); 

            if (logoImg) {
                var qrCenterX = 9 + (96 / 2);
                var qrCenterY = 277 + (96 / 2);
                var logoSize = 22; 
                var bgSize = 23;   
                ctx.fillStyle = "white";
                ctx.fillRect(qrCenterX - (bgSize/2), qrCenterY - (bgSize/2), bgSize, bgSize);
                ctx.drawImage(logoImg, qrCenterX - (logoSize/2), qrCenterY - (logoSize/2), logoSize, logoSize);
            }
        }

        var photoX = 25; var photoY = 120; var fixedHeight = 132; var fixedWidth = 99; 
        if (photoImg) { 
            var ratio = photoImg.width / photoImg.height; var newWidth = fixedHeight * ratio; 
            ctx.lineWidth = 5; ctx.strokeStyle = "white"; ctx.strokeRect(photoX, photoY, newWidth, fixedHeight); ctx.drawImage(photoImg, photoX, photoY, newWidth, fixedHeight); 
        } else { 
            ctx.fillStyle = "#cbd5e1"; ctx.fillRect(photoX, photoY, fixedWidth, fixedHeight); ctx.fillStyle = "#64748b"; ctx.font = "12px Arial"; ctx.fillText("No Foto", photoX + 25, photoY + 70); 
        }

        showLoader(false); 
        openModal('ktaGenModal');
        
        var btnDownload = document.getElementById('downloadKtaBtn'); 
        btnDownload.href = canvas.toDataURL("image/png");
        var namaAman = (d.nama || "Anggota").replace(/[^a-zA-Z0-9]/g, "_"); btnDownload.download = "KTA_Digital_" + namaAman + ".png";
        
    }).catch(function(err) { 
        showLoader(false); 
        Swal.fire("Gagal", "Koneksi lambat/Error Server: " + err.message, "error"); 
    });
}

function showForgotInfo() { 
    Swal.fire({ 
        title: 'Lupa Password?', 
        text: "Masukkan alamat email yang terdaftar pada akun Anda. Sistem akan mengirimkan password baru ke email tersebut.", 
        input: 'email', 
        inputPlaceholder: 'email_anda@gmail.com', 
        showCancelButton: true, 
        confirmButtonText: '<i class="fa fa-paper-plane"></i> Kirim Password', 
        cancelButtonText: 'Batal', 
        confirmButtonColor: '#4f46e5', 
        showLoaderOnConfirm: true, 
        preConfirm: (email) => { 
            return apiCall('forgotPassword', { email: email })
                .then(response => { 
                    if (response.status !== 'success') { 
                        throw new Error(response.message); 
                    } 
                    return response; 
                })
                .catch(error => { 
                    Swal.showValidationMessage(`${error.message}`); 
                }); 
        }, 
        allowOutsideClick: () => !Swal.isLoading() 
    }).then((result) => { 
        if (result.isConfirmed) { 
            Swal.fire({ 
                icon: 'success', 
                title: 'Terkirim!', 
                text: result.value.message,
                confirmButtonColor: '#10b981'
            }); 
        } 
    }); 
}

// Fungsi untuk mengecek apakah ada parameter ?id= di URL saat web pertama kali dibuka
function cekParameterUrl() {
    const params = new URLSearchParams(window.location.search);
    const idProv = params.get('id');
    if (idProv) {
        // Jika ada ID di URL, otomatis buka aplikasi KTA provinsi tersebut
        bukaAplikasiKTA(idProv);
    }
}

// Jalankan pengecekan setelah Portal selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    // Kode inisialisasi portal Anda yang sudah ada...
    // Tambahkan pemanggilan fungsi cek di akhir:
    setTimeout(cekParameterUrl, 1000); 
});
