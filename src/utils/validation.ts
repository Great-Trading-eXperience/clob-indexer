
export const isHexPoolId = (id: string): id is `0x${string}` => {
    return /^0x[0-9a-fA-F]{40}$/.test(id);
}

export const validatePoolId = (poolId: string): `0x${string}` => {
    if (isHexPoolId(poolId)) return poolId;
    throw new Error(`Invalid poolId format: ${poolId}`);
}