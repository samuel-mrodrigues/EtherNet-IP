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
 *      Item count             (UINT, 2 bytes, unsigned)            // Number of items encapsulated
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

import { CIPSendRRDataBuilder } from "./CIP/CIP.js";

import { ItemsCIP } from "../../../../../Utils/SendRRDataItemsTipos.js";
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
        itensEncapsulados: [],
        /**
         * O pacote CIP contém absolutamente tudo que vai ser solicitado no comando SendRRData via protocolo CIP.
         * @type {CIPSendRRDataBuilder}
         */
        CIPEncapsulado: undefined,
    }

    /**
     * Instanciar o comando de SendRRData
     * @param {Object} parametros - Parametros para instanciar o SendRRData
     * @param {Number} parametros.interfaceHandle - O interface Handler que vai ser utilizado para a comunicação. Para CIP, o valor é 0
     * @param {Number} parametros.timeoutRequisicao - O tempo maximo que a requisição pode demorar antes de dar timeout. Para requisições da interface CIP, o timeout é 0 pois ele tem um proprio mecanismo de tratamento de timeouts(segundo o manual)
     */
    constructor(parametros) {

        const valoresPadroes = {
            interfaceHandle: () => {
                this.#campos.interfaceHandle = 0;
            },
            timeoutRequisicao: () => {
                this.#campos.timeoutRequisicao = 10;
            }
        }

        if (parametros != undefined && typeof parametros == 'object') {
            if (parametros.interfaceHandle != undefined) this.setInterfaceHandle(parametros.interfaceHandle);
            if (parametros.timeoutRequisicao != undefined) this.setTimeout(parametros.timeoutRequisicao);
        }

        if (this.#campos.interfaceHandle == undefined) valoresPadroes.interfaceHandle();
        if (this.#campos.timeoutRequisicao == undefined) valoresPadroes.timeoutRequisicao();

        return this;
    }

    /**
     * Definir o interface Handler para o SendRRData
     ** 0: CIP
     * @param {Number} interfaceHandle 
     */
    setInterfaceHandle(interfaceHandle) {
        if (interfaceHandle == undefined) throw new Error(`[CommandSpecificDataSendRRDataBuilder] O Interface Handle não pode ser indefinido`);
        if (typeof interfaceHandle != 'number') throw new Error(`[CommandSpecificDataSendRRDataBuilder] O Interface Handle deve ser um número`);

        this.#campos.interfaceHandle = interfaceHandle;
    }

    /**
     * Definir o timeout para a requisição do SendRRData
     * @param {Number} tempoSegs - Tempo em segundos
     */
    setTimeout(tempoSegs) {
        if (tempoSegs == undefined) throw new Error(`[CommandSpecificDataSendRRDataBuilder] O timeout da requisição não pode ser indefinido`);
        if (typeof tempoSegs != 'number') throw new Error(`[CommandSpecificDataSendRRDataBuilder] O timeout da requisição deve ser um número`);

        this.#campos.timeoutRequisicao = tempoSegs;
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

    /**
     * Gerar os items encapsulados automaticamente utilizando o CIP Encapsulado atual
     ** Segundo o manua, como SendRRData é um comando UCMM, o primeiro item deve endereço do tipo 'Null' e a data do tipo 'Unconnected Message' com o tamanho em bytes do payload CIP 
     */
    gerarItemsEncapsulados() {
        // Limpar os items atuais
        this.#campos.itensEncapsulados = [];

        // Adicionar o item de endereço Null
        this.addItemEncapsulado(ItemsCIP.Null.hex, 0, Buffer.alloc(0));

        if (this.#campos.CIPEncapsulado != undefined) {
            let gerarBufferCIP = this.#campos.CIPEncapsulado.criarBuffer();

            if (!gerarBufferCIP.isSucesso) {
                throw new Error(`[CommandSpecificDataSendRRDataBuilder] Não é possível adicionar o item Unconnected Message: Erro ao gerar o buffer do CIP Encapsulado: ${gerarBufferCIP.erro.descricao}`);
            }

            // Adicionar o item de dados Unconnected Message
            this.addItemEncapsulado(ItemsCIP.UnconnectedMessage.hex, gerarBufferCIP.sucesso.buffer.length, Buffer.alloc(0));
        }
        return this.#campos.itensEncapsulados;
    }

    /**
     * Instanciar o serviço CIP para o SendRRData e solicitar algum serviço ao dispositivo remoto
     */
    criarServicoCIP() {
        let novoCIP = new CIPSendRRDataBuilder();

        this.#campos.CIPEncapsulado = novoCIP;

        return novoCIP;
    }

    /**
     * Criar o buffer do Command Specific Data do SendRRData.
     */
    criarBuffer() {
        const retorBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * O buffer do Command Specific Data
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            }
        }

        // O cabeçalho do Command Specific Data do SendRRData é composto por 8 bytes, que seriam o Interface Handle(4 bytes), Timeout(2 bytes) e Item Count(2 bytes)
        const buffCabecalhoItensEncapsulados = Buffer.alloc(8);

        buffCabecalhoItensEncapsulados.writeUInt32LE(this.#campos.interfaceHandle, 0);
        buffCabecalhoItensEncapsulados.writeUInt16LE(this.#campos.timeoutRequisicao, 4);
        buffCabecalhoItensEncapsulados.writeUInt16LE(this.#campos.itensEncapsulados.length, 6);

        // Então o proximo passo é gerar o buffer do encapsulated packet, que é o que descreve os items encapsulados
        const bufferItensEncapsulado = Buffer.alloc(this.#campos.itensEncapsulados.length * 4);
        let offsetItemEncapsulado = 0;

        for (const itemEncapsulado of this.#campos.itensEncapsulados) {

            // 2 Primeiros bytes é o ID do tipo do item encapsulado
            bufferItensEncapsulado.writeUInt16LE(itemEncapsulado.tipoID, offsetItemEncapsulado);

            // 2 Proximos bytes é o tamanho que ele ocupa nos layers seguintes
            bufferItensEncapsulado.writeUInt16LE(itemEncapsulado.tamanhoBytes, offsetItemEncapsulado + 2);

            // Pular pro proximo item
            offsetItemEncapsulado += 4;
        }

        // Juntar o cabeçalho com o buffer encapsulado
        let bufferCompletoItensEncapsulados = Buffer.concat([buffCabecalhoItensEncapsulados, bufferItensEncapsulado]);

        // Agora que tenho o buffer inicial, concateno com o buffer do CIP encapsulado
        let geraBufferCIP = this.#campos.CIPEncapsulado.criarBuffer();
        if (!geraBufferCIP.isSucesso) {
            retorBuff.erro.descricao = `[CommandSpecificDataSendRRDataBuilder] Erro ao gerar o buffer do CIP Encapsulado: ${geraBufferCIP.erro.descricao}`;
            return retorBuff;
        }

        // Juntar o buffer dos itens encapsulados com o buffer do CIP encapsulado
        let bufferFinal = Buffer.concat([bufferCompletoItensEncapsulados, geraBufferCIP.sucesso.buffer]);

        retorBuff.isSucesso = true;
        retorBuff.sucesso.buffer = bufferFinal;

        return retorBuff;
    }
}