mod utils;

extern crate fixedbitset;
extern crate js_sys;
extern crate web_sys;
use fixedbitset::FixedBitSet;
use std::fmt;
use wasm_bindgen::prelude::*;
use web_sys::console;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// A macro to provide `println!(..)`-style syntax for `console.log` logging.
macro_rules! log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into());
    }
}

#[wasm_bindgen]
pub struct Universe {
    width: u32,
    height: u32,
    cells: FixedBitSet,
}

#[wasm_bindgen]
impl Universe {
    fn get_index(&self, row: u32, column: u32) -> usize {
        (row * self.width + column) as usize
    }

    fn live_neighbor_count(&self, row: u32, column: u32) -> u8 {
        let mut count = 0;
        [self.height - 1, 0, 1]
            .iter()
            .cloned()
            .for_each(|delta_row| {
                [self.width - 1, 0, 1]
                    .iter()
                    .cloned()
                    .for_each(|delta_col| {
                        if delta_row != 0 || delta_col != 0 {
                            let neighbor_row = (row + delta_row) % self.height;
                            let neighbor_col = (column + delta_col) % self.width;
                            let idx = self.get_index(neighbor_row, neighbor_col);
                            count += self.cells[idx] as u8;
                        }
                    });
            });
        count
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    fn reset_cells(&mut self) {
        (0..self.height).for_each(|i| {
            (0..self.width).for_each(|j| {
                let idx = self.get_index(i, j);
                self.cells.set(idx, false);
            });
        });
    }

    // Toggle the cell alive/dead state
    pub fn toggle_cell(&mut self, row: u32, column: u32) {
        let idx = self.get_index(row, column);
        self.cells.toggle(idx);
    }

    // Spawns a glider around the given position
    pub fn spawn_glider(&mut self, row: u32, column: u32) {
        // there is a bug when spawning around the edges or in corners.. think about the indices
        let mut idxs = vec![];
        idxs.push(self.get_index(row, column));
        idxs.push(self.get_index(row - 1, column - 1));
        idxs.push(self.get_index(row - 1, column + 1));
        idxs.push(self.get_index(row, column + 1));
        idxs.push(self.get_index(row + 1, column));
        idxs.iter().for_each(|&i| {
            self.cells.set(i, true);
        });
    }

    // Spawns a pulsar around the given position
    pub fn spawn_pulsar(&mut self, row: u32, column: u32) {
        (0..3).for_each(|i| {
            let idx = self.get_index(row + i, column);
            self.cells.set(idx, true);
        });
    }

    // Clears all alive cells
    pub fn kill_all(&mut self) {
        self.cells.clear();
    }

    // Reset the universe to a random state
    pub fn reset(&mut self) {
        (0..self.height).for_each(|i| {
            (0..self.width).for_each(|j| {
                let idx = self.get_index(i, j);
                self.cells.set(idx, js_sys::Math::random() >= 0.5);
            });
        });
    }

    /// Set the width of the universe.
    ///
    /// Resets all cells to the dead state.
    pub fn set_width(&mut self, width: u32) {
        self.width = width;
        self.reset_cells();
    }

    /// Set the height of the universe.
    ///
    /// Resets all cells to the dead state.
    pub fn set_height(&mut self, height: u32) {
        self.height = height;
        self.reset_cells();
    }

    pub fn cells(&self) -> *const u32 {
        self.cells.as_slice().as_ptr()
    }

    pub fn tick(&mut self) {
        let mut next = self.cells.clone();

        for row in 0..self.height {
            for col in 0..self.width {
                let idx = self.get_index(row, col);
                let cell = self.cells[idx];
                let live_neighbors = self.live_neighbor_count(row, col);

                next.set(
                    idx,
                    match (cell, live_neighbors) {
                        (true, x) if x < 2 => false,
                        (true, 2) | (true, 3) => true,
                        (true, x) if x > 3 => false,
                        (false, 3) => true,
                        (otherwise, _) => otherwise,
                    },
                );
            }
        }

        self.cells = next;
    }

    pub fn new() -> Universe {
        // initialize debugging
        utils::set_panic_hook();

        let width = 64u32;
        let height = 64u32;

        let size = width * height;
        let mut cells = FixedBitSet::with_capacity(size as usize);

        for i in 0..size {
            cells.set(
                i as usize,
                i == 3
                    || i == 1 + height
                    || i == 3 + height
                    || i == 2 + height * 2
                    || i == 3 + height * 2,
            );
        }

        Universe {
            width,
            height,
            cells,
        }
    }

    pub fn render(&self) -> String {
        self.to_string()
    }
}

impl Universe {
    /// Get the dead and alive values of the entire universe.
    pub fn get_cells(&self) -> &[u32] {
        &self.cells.as_slice()
    }

    /// Set cells to be alive in a universe by passing the row and column
    /// of each cell as an array.
    pub fn set_cells(&mut self, cells: &[(u32, u32)]) {
        for (row, col) in cells.iter().cloned() {
            let idx = self.get_index(row, col);
            self.cells.set(idx, true); //[idx] = Cell::Alive;
        }
    }
}

impl fmt::Display for Universe {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        for line in self.cells.as_slice().chunks(self.width as usize) {
            for &cell in line {
                let symbol = if cell == 0u32 { '◻' } else { '◼' };
                write!(f, "{}", symbol)?;
            }
            write!(f, "\n")?;
        }

        Ok(())
    }
}

// utils/profiling
// access performance.now() from the browser
fn now() -> f64 {
    web_sys::window()
        .expect("should have a Window")
        .performance()
        .expect("should have a Performance")
        .now()
}

pub struct Timer<'a> {
    name: &'a str,
}

impl<'a> Timer<'a> {
    pub fn new(name: &'a str) -> Timer<'a> {
        console::time_with_label(name);
        Timer { name }
    }
}

impl<'a> Drop for Timer<'a> {
    fn drop(&mut self) {
        console::time_end_with_label(self.name);
    }
}
