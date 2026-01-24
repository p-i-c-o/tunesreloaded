/**
 * FirewireGuid Setup Module
 * Handles detection and setup of FirewireGuid for iPod Classic 6G+ devices.
 * These devices require the FirewireGuid in SysInfo for libgpod to generate
 * the correct hash, otherwise songs won't appear on the iPod.
 */

export function createFirewireSetup({ log }) {
    const APPLE_VENDOR_ID = 0x05ac;

    /**
     * Check if the iPod has a FirewireGuid in SysInfo or SysInfoExtended
     */
    async function checkFirewireGuid(ipodHandle) {
        try {
            const iPodControl = await ipodHandle.getDirectoryHandle('iPod_Control', { create: false });
            const deviceDir = await iPodControl.getDirectoryHandle('Device', { create: false });
            
            // Try to read SysInfo file
            let sysInfoContent = '';
            try {
                const sysInfoHandle = await deviceDir.getFileHandle('SysInfo', { create: false });
                const file = await sysInfoHandle.getFile();
                sysInfoContent = await file.text();
            } catch (e) {
                // SysInfo doesn't exist, try SysInfoExtended
                try {
                    const sysInfoExtHandle = await deviceDir.getFileHandle('SysInfoExtended', { create: false });
                    const file = await sysInfoExtHandle.getFile();
                    sysInfoContent = await file.text();
                } catch (e2) {
                    log('No SysInfo or SysInfoExtended found', 'info');
                    return false;
                }
            }

            // Check if FirewireGuid is present
            if (sysInfoContent.includes('FirewireGuid')) {
                log('FirewireGuid found in SysInfo', 'success');
                return true;
            }

            log('SysInfo exists but no FirewireGuid', 'info');
            return false;
        } catch (e) {
            // iPod_Control/Device doesn't exist - might be older iPod or not an iPod
            log('Could not check for FirewireGuid: ' + e.message, 'info');
            return true; // Assume OK for older iPods
        }
    }

    /**
     * Get the serial number from the iPod via WebUSB
     */
    async function getSerialViaWebUSB() {
        log('Requesting USB device access...', 'info');
        
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId: APPLE_VENDOR_ID }]
        });

        const serialNumber = device.serialNumber;
        if (!serialNumber) {
            throw new Error('Could not get serial number from device');
        }

        console.log('[FirewireSetup] Serial number from WebUSB:', serialNumber);
        log(`Got serial number: ${serialNumber}`, 'success');
        return serialNumber;
    }

    /**
     * Write the FirewireGuid to the SysInfo file
     */
    async function writeFirewireGuid(ipodHandle, serialNumber) {
        if (!ipodHandle) {
            throw new Error('No iPod folder selected');
        }

        const iPodControl = await ipodHandle.getDirectoryHandle('iPod_Control', { create: true });
        const deviceDir = await iPodControl.getDirectoryHandle('Device', { create: true });
        
        // Read existing SysInfo or create new
        let existingContent = '';
        let isNewFile = true;
        try {
            const existingHandle = await deviceDir.getFileHandle('SysInfo', { create: false });
            const file = await existingHandle.getFile();
            existingContent = await file.text();
            isNewFile = false;
        } catch (e) {
            // File doesn't exist, that's OK
        }

        // Remove any existing FirewireGuid line
        const lines = existingContent.split('\n').filter(line => !line.startsWith('FirewireGuid'));
        
        // Add the new FirewireGuid
        const firewireGuidLine = `FirewireGuid: 0x${serialNumber}`;
        lines.push(firewireGuidLine);
        
        const newContent = lines.join('\n').trim() + '\n';

        // Write the file
        const sysInfoHandle = await deviceDir.getFileHandle('SysInfo', { create: true });
        const writable = await sysInfoHandle.createWritable();
        await writable.write(newContent);
        await writable.close();

        const action = isNewFile ? 'Created' : 'Modified';
        console.log(`[FirewireSetup] ${action} SysInfo file at iPod_Control/Device/SysInfo`);
        console.log(`[FirewireSetup] Added: ${firewireGuidLine}`);
        log(`Wrote FirewireGuid: 0x${serialNumber} to SysInfo`, 'success');
    }

    /**
     * Full setup flow: get serial via WebUSB and write to SysInfo
     */
    async function performSetup(ipodHandle) {
        const serialNumber = await getSerialViaWebUSB();
        await writeFirewireGuid(ipodHandle, serialNumber);
        return serialNumber;
    }

    // Modal helpers
    function showModal() {
        document.getElementById('firewireSetupModal')?.classList.add('show');
    }

    function hideModal() {
        document.getElementById('firewireSetupModal')?.classList.remove('show');
    }

    return {
        checkFirewireGuid,
        getSerialViaWebUSB,
        writeFirewireGuid,
        performSetup,
        showModal,
        hideModal,
    };
}
