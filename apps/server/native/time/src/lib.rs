#![deny(clippy::all)]

use napi_derive::napi;

#[napi]
pub async fn get_time() -> String {
  // Return epoch milliseconds as a string to keep it simple
  use std::time::{SystemTime, UNIX_EPOCH};
  println!("[cmux_native_time] get_time invoked");
  let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
  now.as_millis().to_string()
}
