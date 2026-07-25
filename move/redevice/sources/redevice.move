// Copyright (c) 2026 ReDevice contributors
// SPDX-License-Identifier: MIT

/// Initial package boundary for the ReDevice smart contract.
///
/// DevicePassport, RepairerCap and RepairRecord will be implemented in focused
/// follow-up commits with authorization tests.
module redevice::redevice {
    const PACKAGE_VERSION: u64 = 1;

    public fun package_version(): u64 {
        PACKAGE_VERSION
    }

    #[test]
    fun package_version_starts_at_one() {
        assert!(package_version() == 1, 0);
    }
}
