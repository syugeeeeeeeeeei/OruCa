import http.server
import socketserver
import os
import cgi
import shutil

PORT = 8081
DIRECTORY = "/backups"

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # アップロードフォームを表示するための簡単なHTML
        if self.path == '/upload':
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head><title>Upload Backup</title></head>
            <body>
                <h2>📂 Upload .sql Backup File</h2>
                <form enctype="multipart/form-data" method="post">
                    <p><input type="file" name="file"></p>
                    <p><input type="submit" value="Upload"></p>
                </form>
                <hr>
                <a href="/">Go to File List</a>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/upload':
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST'}
            )
            
            if 'file' in form:
                fileitem = form['file']
                if fileitem.filename:
                    # ファイル名のサニタイズ（簡易的）
                    fn = os.path.basename(fileitem.filename)
                    # 保存先ディレクトリの作成 (Uploadsフォルダ)
                    save_dir = os.path.join(DIRECTORY, "uploads")
                    os.makedirs(save_dir, exist_ok=True)
                    
                    filepath = os.path.join(save_dir, fn)
                    
                    with open(filepath, 'wb') as f:
                        shutil.copyfileobj(fileitem.file, f)
                    
                    self.send_response(200)
                    self.send_header("Content-type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(f"✅ File '{fn}' uploaded successfully to 'uploads/' folder.<br><a href='/'>Back</a>".encode("utf-8"))
                    return

            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Upload failed.")

print(f"🚀 Server started at http://0.0.0.0:{PORT}")
print(f"📂 Serving directory: {DIRECTORY}")
print(f"⬆️  Upload page: http://0.0.0.0:{PORT}/upload")

with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass