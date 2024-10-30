/**
 * Retorna o serviço pelo código HEX se existir
 * @param {Number} hex 
 */
export function getService(hex) {
    return Object.values(Servicos).find(servico => servico.hex == hex);
}

/**
 * Serviços disponiveis para utilizar no contexto atual do layer CIP
 */
export const Servicos = {
    UnconnectedMessageRequest: {
        hex: 0x52,
        descricao: 'Unconnected Message Request'
    },
    MultipleServicePacket: {
        hex: 0x0a,
        descricao: 'Multiple Service Packet'
    },
    SingleServicePacket: {
        hex: 0x4c,
        descricao: 'Single Service Packet'
    },
    ClasseGenerica: {
        hex: 0x01,
        descricao: 'Classe Generica'
    }
}