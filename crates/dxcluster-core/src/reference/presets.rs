//! The bundled `dxclusters.dat` — a list of public DX cluster telnet nodes,
//! offered as presets when the user creates a connection profile.
//!
//! Format: one node per line, four quoted CSV fields
//! `"<name>","<host>","<port>","<software>"`; a final
//! `"VERSION","<version>","23"` line carries the database version.

/// One preset cluster node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClusterPreset {
    /// The node's callsign / identifier (e.g. `"9A0DXC"`, `"DB0ERF-5"`).
    pub name: String,
    pub host: String,
    pub port: u16,
    /// Node software as listed: `"DX Spider"`, `"AR-Cluster"`, `"CC Cluster"`, …
    pub software: String,
}

/// Split a `"a","b","c"` line into its unquoted fields. Tolerant of trailing
/// whitespace / CR; there are no escaped quotes or embedded commas in this data.
fn fields(line: &str) -> Vec<&str> {
    line.trim()
        .trim_start_matches('"')
        .trim_end_matches('"')
        .split("\",\"")
        .collect()
}

/// Parse the file into `(nodes, version)`. Malformed lines are skipped.
pub fn parse_presets(text: &str) -> (Vec<ClusterPreset>, Option<String>) {
    let mut nodes = Vec::new();
    let mut version = None;

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let f = fields(line);
        if f.len() < 3 {
            continue;
        }
        if f[0].eq_ignore_ascii_case("VERSION") {
            version = Some(f[1].to_string());
            continue;
        }
        if f.len() < 4 {
            continue;
        }
        let Ok(port) = f[2].trim().parse::<u16>() else {
            continue;
        };
        let host = f[1].trim();
        if host.is_empty() || port == 0 {
            continue;
        }
        nodes.push(ClusterPreset {
            name: f[0].trim().to_uppercase(),
            host: host.to_string(),
            port,
            software: f[3].trim().to_string(),
        });
    }
    (nodes, version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nodes_and_version() {
        let text = "\"9A0DXC\",\"9a0dxc.hamradio.hr\",\"8000\",\"DX Spider\"\r\n\
                    \n\
                    \"AC2FO\",\"50.182.225.11\",\"23\",\"CC Cluster\"\r\n\
                    \"VERSION\",\"20.26.09.01\",\"23\"\r\n";
        let (nodes, version) = parse_presets(text);
        assert_eq!(version.as_deref(), Some("20.26.09.01"));
        assert_eq!(nodes.len(), 2);
        assert_eq!(
            nodes[0],
            ClusterPreset {
                name: "9A0DXC".into(),
                host: "9a0dxc.hamradio.hr".into(),
                port: 8000,
                software: "DX Spider".into(),
            }
        );
        assert_eq!(nodes[1].host, "50.182.225.11");
        assert_eq!(nodes[1].port, 23);
    }

    #[test]
    fn skips_malformed_rows() {
        let text = "\"BAD\",\"host\",\"notaport\",\"DX Spider\"\n\
                    \"NOHOST\",\"\",\"7300\",\"DX Spider\"\n\
                    \"SHORT\",\"host\"\n\
                    \"OK-1\",\"ok.example\",\"7300\",\"DxNet\"\n";
        let (nodes, _) = parse_presets(text);
        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].name, "OK-1");
    }
}
