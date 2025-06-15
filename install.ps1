# PDF Editor installer for Windows
# This script installs the PDF Editor application on a Windows system.
param (
    [string]$InstallPath = "$env:AppData\PDF Editor"
)

# Check if the installation path exists, if not create it
if (-Not (Test-Path -Path $InstallPath)) {
    Write-Host "Creating installation directory at '$InstallPath'..."
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}
# Copy the PDF Editor files to the installation path
$sourcePath = "$PSScriptRoot"
if (Test-Path -Path $sourcePath) {
    Write-Host "Copying files from '$sourcePath' to '$InstallPath'..."
    Copy-Item -Path $sourcePath\* -Destination $InstallPath -Recurse -Force
} else {
    Write-Error "Source path '$sourcePath' does not exist."
    exit 1
}

# Install uv.exe if it is not already installed
Write-Host "Checking for Python package manager 'uv.exe' installation..."
$uvPath = Get-Command "uv.exe" -ErrorAction SilentlyContinue
if (-not $uvPath) {
    Write-Warning "uv.exe is not installed. Install uv.exe before continuing."
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")
    
    if (-not (Get-Command "uv.exe" -ErrorAction SilentlyContinue)) {
        Write-Error "Failed to install uv.exe. Please install it manually."
        exit 1
    }
}

# Install Python 3.13 for uv
Write-Host "Installing Python 3.13 for uv..."
uv python install 3.13

# Setup the environment for uv
Push-Location $InstallPath
Write-Host "Setting up the environment for uv..."
uv sync
Pop-Location

# Create a shortcut on the desktop
Write-Host "Creating a desktop shortcut for PDF Editor..."
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = "$desktopPath\PDF Editor.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = '-WindowStyle Hidden -ExecutionPolicy Bypass -Command "uv run pythonw pdf_editor.py"'
$shortcut.WorkingDirectory = $InstallPath
$shortcut.WindowStyle = 7 # Minimized window
$shortcut.Description = "PDF Editor Application"
$shortcut.IconLocation = "$InstallPath\icon\pdf_editor.ico"
$shortcut.Save()

# Copy the shortcut to the Start Menu
Write-Host "Copying the shortcut to the Start Menu..."
$startMenuPath = [System.Environment]::GetFolderPath('StartMenu')
Copy-Item -Path $shortcutPath -Destination $startMenuPath -Force

# Display a message indicating successful installation
Write-Host "PDF Editor has been installed successfully to '$InstallPath'."
