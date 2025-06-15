import webview
import os
import base64
from io import BytesIO
from PIL import Image
import fitz  # PyMuPDF
from threading import Thread
import time

class PDFEditorAPI:
    def __init__(self):
        self.current_pdf = None
        self.current_pdf_filename = None
        self.pages = []
        self.pdf_path = None
        self.merged_pdfs = {}  # 結合されたPDFを管理
        
    def open_file_dialog(self, file_types="PDF files (*.pdf)"):
        """ファイル選択ダイアログを開く"""
        try:
            result = webview.windows[0].create_file_dialog(
                webview.OPEN_DIALOG,
                allow_multiple=False,
                file_types=(file_types,)
            )
            return result[0] if result else None
        except Exception as e:
            return None
    
    def save_file_dialog(self):
        """保存ダイアログを開く"""
        try:
            # デフォルトのファイル名を保存ダイアログに指定
            if self.current_filename:
                # 拡張子を除いたファイル名を取得
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                basename = os.path.splitext(self.current_filename)[0]
                default_filename = f"{basename}_modified_{timestamp}.pdf"
            else:
                default_filename = f"modified_{timestamp}.pdf"
            params = {
                "dialog_type": webview.SAVE_DIALOG,
                "allow_multiple": False,
                "file_types": ('PDF files (*.pdf)',),
                "save_filename": default_filename
            }
            result = webview.windows[0].create_file_dialog(**params)
            return result
        except Exception as e:
            return None
    
    def open_pdf(self, file_path, password=None):
        """PDFファイルを開く"""
        try:
            if not file_path or not os.path.exists(file_path):
                return {"success": False, "error": "ファイルが見つかりません"}
            
            # PyMuPDFでPDFを開く
            self.current_pdf = fitz.open(file_path)
            
            # パスワード保護されている場合
            if self.current_pdf.is_encrypted:
                if not password:
                    return {"success": False, "error": "password_required"}
                
                auth_result = self.current_pdf.authenticate(password)
                if not auth_result:
                    return {"success": False, "error": "パスワードが正しくありません"}
            
            self.pdf_path = file_path
            self.current_filename = os.path.basename(file_path) 
            self.pages = []
            self.merged_pdfs = {}  # リセット
            
            # 各ページのサムネイルを生成
            for page_num in range(len(self.current_pdf)):
                page = self.current_pdf[page_num]
                
                # サムネイル画像を生成
                mat = fitz.Matrix(0.5, 0.5)  # 50%のスケール
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")
                
                # Base64エンコード
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                
                self.pages.append({
                    "id": page_num,
                    "thumbnail": f"data:image/png;base64,{img_base64}",
                    "page_num": page_num,
                    "source_pdf": None  # メインPDFの場合はNone
                })
            
            return {
                "success": True,
                "pages": self.pages,
                "filename": os.path.basename(file_path)
            }
            
        except Exception as e:
            return {"success": False, "error": f"PDFファイルの読み込みに失敗しました: {str(e)}"}
    
    def get_page_image(self, page_num, scale=2.0):
        """指定されたページの高解像度画像を取得"""
        try:
            if not self.current_pdf:
                return None
            
            # ページ情報を検索
            page_info = None
            for p in self.pages:
                if p["page_num"] == page_num:
                    page_info = p
                    break
            
            if not page_info:
                return None
            
            # ソースPDFを決定
            if page_info["source_pdf"]:
                # 結合されたPDFからのページ
                if page_info["source_pdf"] not in self.merged_pdfs:
                    return None
                source_pdf = self.merged_pdfs[page_info["source_pdf"]]
                page = source_pdf[page_info["original_page_num"]]
            else:
                # メインPDFからのページ
                page = self.current_pdf[page_num]
            
            mat = fitz.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            
            return f"data:image/png;base64,{img_base64}"
            
        except Exception as e:
            return None
    
    def reorder_pages(self, page_order):
        """ページの順序を変更"""
        try:
            if not self.current_pdf:
                return {"success": False, "error": "PDFファイルが開かれていません"}
            
            # ページの順序を更新
            new_pages = []
            for page_id in page_order:
                for page in self.pages:
                    if page["id"] == page_id:
                        new_pages.append(page)
                        break
            
            self.pages = new_pages
            return {"success": True, "pages": self.pages}
            
        except Exception as e:
            return {"success": False, "error": f"ページの順序変更に失敗しました: {str(e)}"}
    
    def delete_page(self, page_id):
        """ページを削除"""
        try:
            if not self.current_pdf:
                return {"success": False, "error": "PDFファイルが開かれていません"}
            
            # ページを削除
            self.pages = [page for page in self.pages if page["id"] != page_id]
            
            return {"success": True, "pages": self.pages}
            
        except Exception as e:
            return {"success": False, "error": f"ページの削除に失敗しました: {str(e)}"}
    
    def merge_pdf(self, file_path, password=None):
        """別のPDFファイルを結合"""
        try:
            if not file_path or not os.path.exists(file_path):
                return {"success": False, "error": "ファイルが見つかりません"}
            
            # 新しいPDFを開く
            merge_pdf = fitz.open(file_path)
            
            # パスワード保護されている場合
            if merge_pdf.is_encrypted:
                if not password:
                    return {"success": False, "error": "password_required"}
                
                auth_result = merge_pdf.authenticate(password)
                if not auth_result:
                    return {"success": False, "error": "パスワードが正しくありません"}
            
            # 結合されたPDFを管理リストに追加
            self.merged_pdfs[file_path] = merge_pdf
            
            # 現在の最大IDを取得
            max_id = max([page["id"] for page in self.pages]) if self.pages else -1
            
            # 新しいページを追加
            for page_num in range(len(merge_pdf)):
                page = merge_pdf[page_num]
                
                # サムネイル画像を生成
                mat = fitz.Matrix(0.5, 0.5)
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                
                # 新しいページ情報を追加
                new_page = {
                    "id": max_id + 1 + page_num,  # ユニークなIDを生成
                    "thumbnail": f"data:image/png;base64,{img_base64}",
                    "page_num": max_id + 1 + page_num,  # 通し番号として管理
                    "source_pdf": file_path,  # ソースPDFのパス
                    "original_page_num": page_num  # 元のPDF内でのページ番号
                }
                
                self.pages.append(new_page)
            
            return {
                "success": True,
                "pages": self.pages,
                "message": f"{len(merge_pdf)} ページが追加されました"
            }
            
        except Exception as e:
            if file_path in self.merged_pdfs:
                self.merged_pdfs[file_path].close()
                del self.merged_pdfs[file_path]
            return {"success": False, "error": f"PDFファイルの結合に失敗しました: {str(e)}"}
    
    def save_pdf(self, save_path, user_password=None, owner_password=None):
        """PDFファイルを保存"""
        try:
            if not self.current_pdf or not self.pages:
                return {"success": False, "error": "保存するPDFデータがありません"}
            
            # 新しいPDFドキュメントを作成
            output_pdf = fitz.open()
            
            # ページを順番に追加
            for page_info in self.pages:
                if page_info.get('source_pdf'):
                    # 結合されたPDFからのページ
                    if page_info['source_pdf'] in self.merged_pdfs:
                        source_pdf = self.merged_pdfs[page_info['source_pdf']]
                        original_page_num = page_info['original_page_num']
                        output_pdf.insert_pdf(source_pdf, from_page=original_page_num, to_page=original_page_num)
                else:
                    # 元のPDFからのページ
                    # メインPDFから対応するページを探す
                    original_page_num = None
                    for i, original_page in enumerate(self.pages):
                        if original_page['id'] == page_info['id'] and not original_page.get('source_pdf'):
                            original_page_num = original_page['id']  # 元のページ番号
                            break
                    
                    if original_page_num is not None and original_page_num < len(self.current_pdf):
                        output_pdf.insert_pdf(self.current_pdf, from_page=original_page_num, to_page=original_page_num)
            
            # パスワードと権限の設定
            permissions = int(
                fitz.PDF_PERM_PRINT |       # 印刷許可
                fitz.PDF_PERM_COPY |        # コピー許可
                fitz.PDF_PERM_ANNOTATE      # 注釈許可
            )
            # 権限パスワードが設定されている場合、変更を禁止
            if owner_password:
                pass # 上記の権限のみ
            else: # 権限パスワードがなければ、変更も許可
                permissions |= fitz.PDF_PERM_MODIFY
            
            # 暗号化方式の決定
            encryption = fitz.PDF_ENCRYPT_NONE
            if user_password or owner_password:
                encryption = fitz.PDF_ENCRYPT_AES_256 # 強力な暗号化

            # 保存実行
            output_pdf.save(
                save_path,
                garbage=4,  # 未使用オブジェクトをクリーンアップ
                deflate=True,  # 圧縮を有効にする
                encryption=encryption,
                owner_pw=owner_password if owner_password else None,
                user_pw=user_password if user_password else None,
                permissions=permissions,
            )
            output_pdf.close()
            
            return {"success": True, "message": "PDFファイルが保存されました"}
            
        except Exception as e:
            return {"success": False, "error": f"PDFファイルの保存に失敗しました: {str(e)}"}

    def __del__(self):
        """デストラクタ - 開いているPDFファイルをクリーンアップ"""
        try:
            if self.current_pdf:
                self.current_pdf.close()
            for pdf in self.merged_pdfs.values():
                pdf.close()
        except:
            pass

def main():
    """メインアプリケーション"""
    api = PDFEditorAPI()
    
    # pywebviewウィンドウを作成
    window = webview.create_window(
        'PDF Editor',
        'gui/index.html',
        js_api=api,
        width=1200,
        height=800,
        min_size=(800, 600),
        resizable=True
    )
    
    # アプリケーション開始
    webview.start(debug=False)

if __name__ == '__main__':
    main()