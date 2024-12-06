/**
 * Tipos de items disponiveis para encapsulamento
 */
export const ItemsCIP = {
    Null: {
        hex: 0x0000,
        descricao: 'Null'
    },
    ConnectedMessage: {
        hex: 0xA1,
        descricao: 'Connected Message'
    },
    UnconnectedMessage: {
        hex: 0x00B2,
        descricao: 'Unconnected Message'
    },
    ConnectedTransportPacket: {
        hex: 0x00B1,
        descricao: 'Connected Transport Packet'
    }
}

/**
 * Retorna o item encapsulado de acordo com o codigo
 * @param {Number} codigo 
 */
export function getItemTipo(codigo) {
    return Object.values(ItemsCIP).find(item => item.hex === codigo);
}