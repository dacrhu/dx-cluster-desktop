//! Offline reference data: the DXCC country file and geo math.

pub mod cty;
pub mod geo;

pub use cty::{CtyDb, Entity, Match as CtyMatch};
pub use geo::{great_circle, latlon_to_locator, locator_to_latlon};
