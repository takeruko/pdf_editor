let currentPages = [];
let selectedPages = [];
let currentOperation = null;
let draggedElement = null;
let draggedPageId = null;

// ページ要素をレンダリング
function renderPages() {
    const container = document.getElementById('pages-container');
    
    if (currentPages.length === 0) {
        // ファイル名表示を非表示（visibleクラスを削除）
        document.getElementById('filename-display').classList.remove('visible');
        document.getElementById('filename-text').textContent = 'ファイルが選択されていません';
        
    
        // ページがない場合のメッセージを表示
        container.innerHTML = `
            <div class="empty-state">
                <h2>PDFファイルを開いてください</h2>
                <p>「PDFを開く」ボタンをクリックしてPDFファイルを選択してください</p>
            </div>
        `;
        // グリッドレイアウトを一時的に変更
        container.style.gridTemplateColumns = '1fr';
        container.style.placeItems = 'center';
        return;
    }
    
    // PDFが読み込まれた場合は通常のグリッドに戻す
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
    container.style.placeItems = 'unset';
    
    container.innerHTML = '';
    
    currentPages.forEach((page, index) => {
        const pageElement = document.createElement('div');
        pageElement.className = 'page-item';
        pageElement.draggable = true;
        pageElement.dataset.pageId = page.id;
        
        pageElement.innerHTML = `
            <button class="delete-btn" onclick="deletePage(${page.id}); event.stopPropagation();">×</button>
            <img class="page-thumbnail" src="${page.thumbnail}" alt="Page ${index + 1}" draggable="false">
            <div class="page-info">ページ ${index + 1}</div>
        `;
        
        // クリックイベント
        pageElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target.classList.contains('delete-btn')) return;
            togglePageSelection(page.id);
        });
        
        // ダブルクリックイベント
        pageElement.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showPagePreview(page.id);
        });
        
        // ドラッグ開始
        pageElement.addEventListener('dragstart', (e) => {
            draggedElement = pageElement;
            draggedPageId = parseInt(page.id);
            pageElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', page.id);
        });
        
        // ドラッグ終了
        pageElement.addEventListener('dragend', (e) => {
            pageElement.classList.remove('dragging');
            // 全ての要素からdrag-overクラスを削除
            document.querySelectorAll('.page-item').forEach(item => {
                item.classList.remove('drag-over');
            });
            draggedElement = null;
            draggedPageId = null;
        });
        
        // ドラッグオーバー
        pageElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (draggedElement && draggedElement !== pageElement) {
                pageElement.classList.add('drag-over');
            }
        });
        
        // ドラッグ離脱
        pageElement.addEventListener('dragleave', (e) => {
            // 子要素に移動した場合は無視
            if (!pageElement.contains(e.relatedTarget)) {
                pageElement.classList.remove('drag-over');
            }
        });
        
        // ドロップ
        pageElement.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            pageElement.classList.remove('drag-over');
            
            if (draggedElement && draggedElement !== pageElement && draggedPageId !== null) {
                const targetPageId = parseInt(pageElement.dataset.pageId);
                reorderPages(draggedPageId, targetPageId);
            }
        });
        
        container.appendChild(pageElement);
    });
}

// ページ選択の切り替え
function togglePageSelection(pageId) {
    const pageElement = document.querySelector(`[data-page-id="${pageId}"]`);
    
    if (selectedPages.includes(pageId)) {
        selectedPages = selectedPages.filter(id => id !== pageId);
        pageElement.classList.remove('selected');
    } else {
        selectedPages.push(pageId);
        pageElement.classList.add('selected');
    }
}

// ページプレビュー表示
async function showPagePreview(pageId) {
    showLoading();
    
    try {
        const page = currentPages.find(p => p.id === pageId);
        if (!page) return;
        
        // 高解像度画像を取得
        const imageData = await pywebview.api.get_page_image(page.page_num, 2.0);
        
        if (imageData) {
            document.getElementById('modalImage').src = imageData;
            document.getElementById('imageModal').style.display = 'block';
        }
    } catch (error) {
        showToast('ページプレビューの取得に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ページ順序の変更
async function reorderPages(draggedPageId, targetPageId) {
    const draggedIndex = currentPages.findIndex(p => p.id == draggedPageId);
    const targetIndex = currentPages.findIndex(p => p.id == targetPageId);
    
    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
    
    // 配列内で要素を移動
    const draggedPage = currentPages[draggedIndex];
    currentPages.splice(draggedIndex, 1);
    currentPages.splice(targetIndex, 0, draggedPage);
    
    // サーバーに順序変更を通知
    const pageOrder = currentPages.map(p => p.id);
    
    try {
        const result = await pywebview.api.reorder_pages(pageOrder);
        if (result.success) {
            currentPages = result.pages;
            renderPages();
            showToast('ページの順序を変更しました', 'success');
        } else {
            showToast(result.error, 'error');
            // エラーの場合は元の順序に戻す
            currentPages.splice(targetIndex, 1);
            currentPages.splice(draggedIndex, 0, draggedPage);
        }
    } catch (error) {
        showToast('ページの順序変更に失敗しました', 'error');
        // エラーの場合は元の順序に戻す
        currentPages.splice(targetIndex, 1);
        currentPages.splice(draggedIndex, 0, draggedPage);
    }
}

// PDFファイルを開く
async function openPDF() {
    showLoading();
    
    try {
        const filePath = await pywebview.api.open_file_dialog('PDF files (*.pdf)');
        if (!filePath) {
            hideLoading();
            return;
        }
        
        await loadPDF(filePath);
    } catch (error) {
        showToast('ファイル選択に失敗しました', 'error');
        hideLoading();
    }
}

// PDFファイルを読み込む
async function loadPDF(filePath, password = null) {
    // パスワード入力からの呼び出しでない場合のみローディング表示
    if (password === null) {
        showLoading();
    }
    
    try {
        const result = await pywebview.api.open_pdf(filePath, password);
        
        if (result.success) {
            currentPages = result.pages;
            selectedPages = [];
            renderPages();
            
            // ファイル名を表示（visibleクラスを追加）
            document.getElementById('filename-text').textContent = result.filename;
            document.getElementById('filename-display').classList.add('visible');
            
            showToast(`${result.filename} を開きました`, 'success');
        } else if (result.error === 'password_required') {
            currentOperation = { type: 'open', filePath: filePath };
            showPasswordDialog();
            return; // hideLoading()を呼ばずに戻る
        } else if (result.error === 'パスワードが正しくありません') {
            showToast(result.error, 'error');
            // パスワード再入力のためにダイアログを再表示
            currentOperation = { type: 'open', filePath: filePath };
            showPasswordDialog();
            return; // hideLoading()を呼ばずに戻る
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('PDFファイルの読み込みに失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// PDFファイルを結合
async function mergePDF() {
    if (currentPages.length === 0) {
        showToast('まず最初にPDFファイルを開いてください', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const filePath = await pywebview.api.open_file_dialog('PDF files (*.pdf)');
        if (!filePath) {
            hideLoading();
            return;
        }
        
        await mergePDFFile(filePath);
    } catch (error) {
        showToast('ファイル選択に失敗しました', 'error');
        hideLoading();
    }
}

// PDFファイルを結合実行
async function mergePDFFile(filePath, password = null) {
    // パスワード入力からの呼び出しでない場合のみローディング表示
    if (password === null) {
        showLoading();
    }
    
    try {
        const result = await pywebview.api.merge_pdf(filePath, password);
        
        if (result.success) {
            currentPages = result.pages;
            renderPages();
            showToast(result.message, 'success');
        } else if (result.error === 'password_required') {
            currentOperation = { type: 'merge', filePath: filePath };
            showPasswordDialog();
            return;
        } else if (result.error === 'パスワードが正しくありません') {
            showToast(result.error, 'error');
            currentOperation = { type: 'merge', filePath: filePath };
            showPasswordDialog();
            return;
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('PDFファイルの結合に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ページを削除
function deletePage(pageId) {
    if (confirm('このページを削除しますか？')) {
        deletePageById(pageId);
    }
}

// 選択されたページを削除
function deleteSelected() {
    if (selectedPages.length === 0) {
        showToast('削除するページを選択してください', 'error');
        return;
    }
    
    if (confirm(`選択された${selectedPages.length}ページを削除しますか？`)) {
        selectedPages.forEach(pageId => {
            deletePageById(pageId);
        });
        selectedPages = [];
    }
}

// IDでページを削除
async function deletePageById(pageId) {
    try {
        const result = await pywebview.api.delete_page(pageId);
        
        if (result.success) {
            currentPages = result.pages;
            selectedPages = selectedPages.filter(id => id !== pageId);
            renderPages();
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('ページの削除に失敗しました', 'error');
    }
}

// PDFを保存
function savePDF() {
    if (currentPages.length === 0) {
        showToast('保存するPDFファイルがありません', 'error');
        return;
    }
    
    document.getElementById('saveModal').style.display = 'block';
}

// 保存実行
async function executeSave() {
    showLoading();
    closeSaveModal();
    
    try {
        const savePath = await pywebview.api.save_file_dialog();
        if (!savePath) {
            hideLoading();
            return;
        }
        
        const userPassword = document.getElementById('userPassword').value;
        const ownerPassword = document.getElementById('ownerPassword').value;
        
        const result = await pywebview.api.save_pdf(savePath, userPassword, ownerPassword);
        
        if (result.success) {
            showToast(result.message, 'success');
            // パスワードフィールドをクリア
            document.getElementById('userPassword').value = '';
            document.getElementById('ownerPassword').value = '';
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('PDFファイルの保存に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// パスワードダイアログを表示
function showPasswordDialog() {
    document.getElementById('passwordModal').style.display = 'block';
    document.getElementById('passwordInput').focus();
}

// パスワード送信
async function submitPassword() {
    const password = document.getElementById('passwordInput').value.trim();
    
    if (!password) {
        showToast('パスワードを入力してください', 'error');
        return;
    }
    
    closePasswordModal();
    showLoading(); // ここでローディング表示を開始
    
    if (currentOperation) {
        if (currentOperation.type === 'open') {
            await loadPDF(currentOperation.filePath, password);
        } else if (currentOperation.type === 'merge') {
            await mergePDFFile(currentOperation.filePath, password);
        }
        currentOperation = null;
    }
}

// モーダル関連の関数
function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
}

function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('passwordInput').value = '';
    hideLoading();
}

function closeSaveModal() {
    document.getElementById('saveModal').style.display = 'none';
}

// ローディング表示/非表示
function showLoading() {
    const loading = document.getElementById('loading');
    loading.style.display = 'flex'; // 'block'から'flex'に変更
}

function hideLoading() {
    const loading = document.getElementById('loading');
    loading.style.display = 'none';
}

// トースト通知
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// パスワード可視化機能
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const eyeIcon = document.getElementById(inputId + 'Eye');
    
    if (input.type === 'password') {
        // パスワードを表示
        input.type = 'text';
        // 目のアイコンを「閉じた目」に変更
        eyeIcon.innerHTML = `
            <path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z"/>
            <path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12-.708.708z"/>
        `;
    } else {
        // パスワードを隠す
        input.type = 'password';
        // 目のアイコンを「開いた目」に変更
        eyeIcon.innerHTML = `
            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
        `;
    }
}

// キーボードショートカット
document.addEventListener('keydown', (e) => {
    // Delete キーで選択ページを削除
    if (e.key === 'Delete' && selectedPages.length > 0) {
        deleteSelected();
    }
    
    // Escape キーでモーダルを閉じる
    if (e.key === 'Escape') {
        closeModal();
        closePasswordModal();
        closeSaveModal();
    }
    
    // Ctrl+O でファイルを開く
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        openPDF();
    }
    
    // Ctrl+S で保存
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        savePDF();
    }
});

// パスワード入力でEnterキー
document.getElementById('passwordInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitPassword();
    }
});

// モーダル背景クリックで閉じる
document.getElementById('imageModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('imageModal')) {
        closeModal();
    }
});

document.getElementById('passwordModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('passwordModal')) {
        closePasswordModal();
    }
});

document.getElementById('saveModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('saveModal')) {
        closeSaveModal();
    }
});