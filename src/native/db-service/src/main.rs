//! Tengra Database Service
//!
//! A Windows Service that hosts the SQLite database with vector search support
//! for the Tengra AI assistant application.

// Hide console window on Windows release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod handlers;
mod server;
mod types;

use anyhow::{Context, Result};
use std::ffi::OsString;
use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::oneshot;

use database::Database;

#[cfg(windows)]
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_dispatcher,
};

const SERVICE_NAME: &str = "TengraDatabaseService";
const SERVICE_DISPLAY_NAME: &str = "Tengra Database Service";

/// Get the database path
fn get_db_path() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
            .join("Tengra")
            .join("runtime")
            .join("db")
            .join("Tengra.db")
    } else {
        PathBuf::from("Tengra.db")
    }
}

/// Get the services directory for port file
fn get_services_dir() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata).join("Tengra").join("services")
    } else {
        PathBuf::from(".")
    }
}

/// Write the port file for service discovery
fn write_port_file(port: u16) -> Result<()> {
    let services_dir = get_services_dir();
    fs::create_dir_all(&services_dir)?;
    let port_file = services_dir.join("db-service.port");
    fs::write(port_file, port.to_string())?;
    Ok(())
}

/// Remove the port file on shutdown
fn remove_port_file() {
    let port_file = get_services_dir().join("db-service.port");
    let _ = fs::remove_file(port_file);
}

/// Run the database server
async fn run_server(shutdown_rx: Option<oneshot::Receiver<()>>) -> Result<()> {
    let logs_dir = resolve_logs_dir();
    let _ = fs::create_dir_all(&logs_dir);
    let file_appender = tracing_appender::rolling::daily(logs_dir, "tengra-db-service.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("tengra_db_service=info".parse().unwrap()),
        )
        .with_writer(non_blocking)
        .init();
    std::mem::forget(guard);

    tracing::info!(
        "Starting Tengra Database Service v{}",
        env!("CARGO_PKG_VERSION")
    );

    // Initialize database
    let db_path = get_db_path();
    tracing::info!("Database path: {:?}", db_path);

    let db = Database::new(&db_path).context("Failed to create database")?;
    db.initialize()
        .await
        .context("Failed to initialize database")?;

    let db = Arc::new(db);
    let start_time = std::time::Instant::now();

    // Create router
    let router = server::create_router(db, start_time);

    // Bind to a random available port
    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = TcpListener::bind(addr).await?;
    let local_addr = listener.local_addr()?;
    let port = local_addr.port();

    tracing::info!("Database service listening on {}", local_addr);

    // Write port file for discovery
    write_port_file(port)?;
    tracing::info!(
        "Port file written: {}/db-service.port",
        get_services_dir().display()
    );

    // Run server with optional shutdown signal
    if let Some(shutdown_rx) = shutdown_rx {
        axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
                tracing::info!("Shutdown signal received");
            })
            .await?;
    } else {
        axum::serve(listener, router).await?;
    }

    // Cleanup
    remove_port_file();
    tracing::info!("Database service stopped");

    Ok(())
}

fn resolve_logs_dir() -> PathBuf {
    if let Ok(path) = std::env::var("TENGRA_DB_SERVICE_LOG_DIR") {
        return PathBuf::from(path);
    }

    if let Ok(appdata) = std::env::var("APPDATA") {
        return PathBuf::from(appdata).join("Tengra").join("logs");
    }

    PathBuf::from("logs")
}

// ============================================================================
// Windows Service Implementation
// ============================================================================

#[cfg(windows)]
define_windows_service!(ffi_service_main, service_main);

#[cfg(windows)]
fn service_main(_arguments: Vec<OsString>) {
    if let Err(e) = run_service() {
        tracing::error!("Service failed: {}", e);
    }
}

#[cfg(windows)]
fn run_service() -> Result<()> {
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let shutdown_tx = std::sync::Mutex::new(Some(shutdown_tx));

    // Create event handler
    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop | ServiceControl::Shutdown => {
                if let Some(tx) = shutdown_tx.lock().unwrap().take() {
                    let _ = tx.send(());
                }
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    // Register event handler
    let status_handle = service_control_handler::register(SERVICE_NAME, event_handler)?;

    // Report running status
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    // Create runtime and run server
    let rt = tokio::runtime::Runtime::new()?;
    let result = rt.block_on(run_server(Some(shutdown_rx)));

    // Report stopped status
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: if result.is_ok() {
            ServiceExitCode::Win32(0)
        } else {
            ServiceExitCode::Win32(1)
        },
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    result
}

// ============================================================================
// Entry Point
// ============================================================================

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();

    // Check for command line arguments
    if args.len() > 1 {
        match args[1].as_str() {
            "--console" | "-c" => {
                // Run in console mode (for development/debugging)
                let rt = tokio::runtime::Runtime::new()?;
                rt.block_on(run_server(None))?;
                return Ok(());
            }
            "--install" | "-i" => {
                #[cfg(windows)]
                {
                    install_service()?;
                    println!("Service installed successfully");
                }
                #[cfg(not(windows))]
                {
                    eprintln!("Service installation is only supported on Windows");
                }
                return Ok(());
            }
            "--uninstall" | "-u" => {
                #[cfg(windows)]
                {
                    uninstall_service()?;
                    println!("Service uninstalled successfully");
                }
                #[cfg(not(windows))]
                {
                    eprintln!("Service uninstallation is only supported on Windows");
                }
                return Ok(());
            }
            "--help" | "-h" => {
                println!("Tengra Database Service v{}", env!("CARGO_PKG_VERSION"));
                println!();
                println!("Usage: Tengra-db-service [OPTIONS]");
                println!();
                println!("Options:");
                println!("  --console, -c     Run in console mode (foreground)");
                println!("  --install, -i     Install as Windows Service");
                println!("  --uninstall, -u   Uninstall Windows Service");
                println!("  --help, -h        Show this help message");
                println!();
                println!(
                    "Without arguments, the service will attempt to run as a Windows Service."
                );
                return Ok(());
            }
            _ => {
                eprintln!("Unknown argument: {}", args[1]);
                eprintln!("Use --help for usage information");
                return Ok(());
            }
        }
    }

    // Run as Windows Service
    #[cfg(windows)]
    {
        service_dispatcher::start(SERVICE_NAME, ffi_service_main)?;
    }

    #[cfg(not(windows))]
    {
        // On non-Windows, just run in console mode
        let rt = tokio::runtime::Runtime::new()?;
        rt.block_on(run_server(None))?;
    }

    Ok(())
}

// ============================================================================
// Service Installation/Uninstallation (Windows only)
// ============================================================================

#[cfg(windows)]
fn install_service() -> Result<()> {
    use std::process::Command;

    let exe_path = std::env::current_exe()?;
    let exe_path_str = exe_path.to_string_lossy();

    // Create service using sc.exe
    let output = Command::new("sc.exe")
        .args([
            "create",
            SERVICE_NAME,
            &format!("binPath= \"{}\"", exe_path_str),
            "start= auto",
            &format!("DisplayName= \"{}\"", SERVICE_DISPLAY_NAME),
        ])
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Failed to create service: {}", stderr);
    }

    // Set description
    let _ = Command::new("sc.exe")
        .args([
            "description",
            SERVICE_NAME,
            "Manages the Tengra application database for AI assistant features",
        ])
        .output();

    // Start the service
    let _ = Command::new("sc.exe")
        .args(["start", SERVICE_NAME])
        .output();

    Ok(())
}

#[cfg(windows)]
fn uninstall_service() -> Result<()> {
    use std::process::Command;

    // Stop the service first
    let _ = Command::new("sc.exe").args(["stop", SERVICE_NAME]).output();

    // Wait a bit for service to stop
    std::thread::sleep(Duration::from_secs(2));

    // Delete the service
    let output = Command::new("sc.exe")
        .args(["delete", SERVICE_NAME])
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Failed to delete service: {}", stderr);
    }

    // Remove port file
    remove_port_file();

    Ok(())
}
