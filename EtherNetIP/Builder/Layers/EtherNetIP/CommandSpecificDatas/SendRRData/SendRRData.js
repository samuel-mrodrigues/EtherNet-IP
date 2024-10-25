/**
 * SendRRData possui um Command Specific Data com 3 campos
 */

/**
 * SendRRData só deve ser utilizado para enviar solicitações do tipo UCMM(Unconnected Messages) segundo o manual.
 */

// Vamos lá, seguindo a explicação do manual, o SendRRData encapsula um array de "itens" encapsulados, que descrevem as informações dos layers futuros. 
// Por exemplo, segundo o manual, cada "item" tem uma função, alguns itens são do tipo "endereço" e outros "data" dependendo da situação, entendi que é meio que o caminho que vc quer solicitar.
// O manual consta que, obrigatoriamente primeiro um item endereço deve ser informado, seguido pelo item do tipo data do que vai ser solicitado, e então outros itens adicionais podem ser adicionados.
// Mas o ordem que deve ser respeita pelo menos pra mensagens não conectadas é: O item endereço -> item data -> outros item se necessário
// E então em layers futuros pra frente, o payload desses itens devem ser descritos.

// O Command Specific Data do SendRRData é composto dos tres campos abaixo:
/**
 * EncapsulationPacket
 *      Interface handle       (UDINT, 4 bytes, unsigned)           // Shall be 0 for CIP
 *      Timeout                (UINT, 2 bytes, unsigned)            // Operation timeout
 *      Encapsulated packet     (ARRAY of octet, variable length)    // See Common Packet Format specification in section 2-6
 */

// O Interface Handler é o tipo da interface que tá sendo usado pra comunicar a informação.
// O timeout é o tempo de espera da solicitação, que segundo o manual pode ser 0 pois o CIP tem seu proprio mecanismo pra tratar os timeouts
// E o ultimo campo finalmente é o encapsulated packet, que é um array que descreve os itens encapsulados nos layers futuros.

// Não entendi se os outros handlers diferentes(alem do CIP) teriam uma estrutura diferente do CIP abaixo

// O Encapsulated packet pelo menos para o protocolo CIP segue esse formato:
/**
 * ItemType
 *      Type ID              (UINT, 2 bytes, unsigned)            // Type of item encapsulated
 *      Length               (UINT, 2 bytes, unsigned)            // Length in bytes of the Data Field
 *      Data                 (Variable length)                    // The data (if length > 0)
 */

// Porém essa estrutura acima é como deve ser estruturada para Handler Interface do tipo CIP, não se se é a mesma coisa para outros tipos de interface.

// Basicamente os items contidos no SendRRData são os items que estão nos layers pra frente, e o encapsulated packet é o que descreve as informações basicas do item, como tamanho por exemplo.

/**
 * @typedef ItemEncapsulamento
 * @property {Number} ordemId - Ordem numerica da sequencia do item na lista de items
 * @property {Number} tipoID - ID do tipo do item de encapsulamento
 * @property {Number} tamanhoBytes - Tamanho em bytes do pacote encapsulado
 * @property {Buffer} dados - Dados do item encapsulado (se necessario)
 */

/**
 * Montagem de um comando Command Specific Data para o tipo de comando SendRRData. O evento SendRRData só deve ser usado para mensagens UCMM(unconnected messages) segundo o manual.
 ** Pelo menos no caso do CIP, o Encapsulated packet tem que conter informações de items encapsulados nos layers mais pra frente.
 */
export class CommandSpecificDataSendRRDataBuilder {

    /**
     * Campos necessarios para o Command Specific Data do SendRRData
     */
    #campos = {
        /**
         * O interface Handler é pra descrever qual interface de comunicação será utilizada. para CIP, o codigo é 0;
         */
        interfaceHandle: undefined,
        /**
         * Tempo maximo que a requisição pode demorar antes de dar timeout. Para requisições da interface CIP, o timeout é 0 pois ele tem um proprio mecanismo de tratamento de timeouts(segundo o manual)
         */
        timeoutRequisicao: undefined,
        /**
         * Os itens que vão ser encapsulados no protocolo
         ** Observação que primeiramente precisa ser o item de conexão, e depois os itens de dados
         * @type {ItemEncapsulamento[]}
         */
        itensEncapsulados: []
    }

    /**
     * Instanciar o comando de SendRRData
     */
    constructor() {
        return this;
    }

    /**
     * Adicionar um item de encapsulamento
     * @param {Number} codigoItem - Codigo do item de encapsulamento(veja a lista de items disponiveis em ItemsCIP)
     * @param {Number} tamanho - Tamanho em bytes do item encapsulado
     * @param {Buffer} dados - Dados do item encapsulado se necessario
     */
    addItemEncapsulado(codigoItem, tamanho, dados) {
        /**
         * @type {ItemEncapsulamento}
         */
        let novoItem = {
            ordemId: this.#campos.itensEncapsulados.length,
            tipoID: codigoItem,
            tamanhoBytes: tamanho,
            dados: dados
        }

        this.#campos.itensEncapsulados.push(novoItem);

        return novoItem;
    }



    /**
     * Remove um item dos items para encapsular
     * @param {Number} index 
     */
    excluirItemEncapsulado(index) {
        this.#campos.itensEncapsulados.splice(index, 1);
    }

    /**
     * Retorna um item encapsulado pelo ID de sequencia
     * @param {Number} id 
     */
    getItemEncapsulado(id) {
        return this.#campos.itensEncapsulados.find(item => item.ordemId == id);
    }

    /**
     * Retorna todos os items encapsulados
     */
    getItemsEncapsulados() {
        return this.#campos.itensEncapsulados;
    }
}

/**
 * Tipos de items disponiveis para encapsular no items do SendRRData
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