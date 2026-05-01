/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::task;
use uuid::Uuid;

pub struct TerminalSession {
    pub id: String,
    pub tx: broadcast::Sender<Vec<u8>>,
    master: Arc<parking_lot::Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    writer: Arc<parking_lot::Mutex<Box<dyn Write + Send>>>,
}

impl TerminalSession {
    pub fn new(
        cwd: Option<String>,
        shell: Option<String>,
        args: Option<Vec<String>>,
    ) -> anyhow::Result<Self> {
        let pty_system = NativePtySystem::default();
        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let shell = shell.unwrap_or_else(|| {
            if cfg!(windows) {
                "powershell.exe".to_string()
            } else {
                "bash".to_string()
            }
        });

        let mut cmd = CommandBuilder::new(shell);
        if let Some(args) = args {
            cmd.args(args);
        }
        if let Some(cwd) = cwd {
            cmd.cwd(cwd);
        }

        let _child = pair.slave.spawn_command(cmd)?;

        // We don't strictly need to keep the slave once the process is spawned
        // but we need to keep the master to communicate.
        // portable_pty's take_writer() can only be called once, so we grab it here and reuse it.
        let master_pty = pair.master;
        let writer = master_pty.take_writer()?;
        let master = Arc::new(parking_lot::Mutex::new(master_pty));
        let writer = Arc::new(parking_lot::Mutex::new(writer));
        let (tx, _rx) = broadcast::channel(1024);

        let id = Uuid::new_v4().to_string();

        // Spawn Background Reader
        let reader_master: Arc<parking_lot::Mutex<Box<dyn portable_pty::MasterPty + Send>>> =
            Arc::clone(&master);
        let reader_tx = tx.clone();

        task::spawn_blocking(move || {
            let mut reader = reader_master.lock().try_clone_reader().unwrap();
            let mut buffer = [0u8; 1024];
            while let Ok(n) = reader.read(&mut buffer) {
                if n == 0 {
                    break;
                }
                let _ = reader_tx.send(buffer[..n].to_vec());
            }
        });

        Ok(Self {
            id,
            tx,
            master,
            writer,
        })
    }

    pub fn write(&self, data: &[u8]) -> anyhow::Result<()> {
        let mut writer = self.writer.lock();
        writer.write_all(data)?;
        writer.flush()?;
        Ok(())
    }

    pub fn resize(&self, rows: u16, cols: u16) -> anyhow::Result<()> {
        self.master.lock().resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }
}
