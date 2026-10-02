//! Offline spell checking with Hunspell dictionaries (spellbook). English and
//! German ship with the app; each is parsed on first use and kept in memory.

use spellbook::Dictionary;
use std::sync::OnceLock;

static EN: OnceLock<Dictionary> = OnceLock::new();
static DE: OnceLock<Dictionary> = OnceLock::new();

fn dictionary(lang: &str) -> Result<&'static Dictionary, String> {
  let (cell, aff, dic) = match lang {
    "en" => (&EN, include_str!("../dictionaries/en/index.aff"), include_str!("../dictionaries/en/index.dic")),
    "de" => (&DE, include_str!("../dictionaries/de/index.aff"), include_str!("../dictionaries/de/index.dic")),
    _ => return Err(format!("No dictionary for language '{lang}'")),
  };
  Ok(cell.get_or_init(|| Dictionary::new(aff, dic).expect("bundled dictionary is valid")))
}

/// For each word, true when it is spelled correctly in any of the languages.
#[tauri::command]
pub async fn spell_check(langs: Vec<String>, words: Vec<String>) -> Result<Vec<bool>, String> {
  let dicts = langs.iter().map(|l| dictionary(l)).collect::<Result<Vec<_>, _>>()?;
  Ok(words.iter().map(|w| dicts.iter().any(|d| d.check(w))).collect())
}

/// Up to `limit` suggestions, merged across the languages.
#[tauri::command]
pub async fn spell_suggest(langs: Vec<String>, word: String, limit: usize) -> Result<Vec<String>, String> {
  let mut out: Vec<String> = Vec::new();
  for lang in &langs {
    let mut s = Vec::new();
    dictionary(lang)?.suggest(&word, &mut s);
    for w in s {
      if !out.contains(&w) {
        out.push(w);
      }
    }
  }
  out.truncate(limit);
  Ok(out)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn checks_english_and_german_compounds() {
    assert!(dictionary("en").unwrap().check("castle"));
    assert!(!dictionary("en").unwrap().check("castel"));
    assert!(dictionary("de").unwrap().check("Burg"));
    assert!(dictionary("de").unwrap().check("Burgtor"));
    let mut s = Vec::new();
    dictionary("en").unwrap().suggest("castel", &mut s);
    assert!(s.iter().any(|w| w == "castle"));
  }
}
