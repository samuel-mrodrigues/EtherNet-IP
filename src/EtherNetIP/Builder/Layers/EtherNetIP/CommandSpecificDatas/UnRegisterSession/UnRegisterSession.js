import { TraceLog } from "../../../../../Utils/TraceLog.js";
import { hexDeBuffer } from "../../../../../Utils/Utils.js";

export class CommandSpecificDataUnRegisterSessionBuilder {

    /**
     * Instanciar o builder
     ** O comando de UnRegisterSession não possui campos pois o unico payload necessario pra enviar é o Session Handler, que é enviado no encapsulamento do EtherNet/IP e não aqui.
     */
    constructor() {
        return this;
    }

    /**
     * Constrói o Buffer. No caso do UnRegister Session, retorna um vazio pois não é necessario enviar o Command Specific Data
     */
    criarBuffer() {
        const retornoBuff = {
            isSucesso: false,
            sucesso: {
                buffer: undefined
            },
            erro: {
                descricao: ''
            },
            /**
            * O tracer log contém as etapas da geração do Buffer
            * @type {TraceLog}
            */
            tracer: new TraceLog()
        }

        const tracerCriacao = retornoBuff.tracer.addTipo('UnRegisterSession');

        // O buffer tem que ser de 0 bytes. Não há campos a serem configurados
        const buff = Buffer.alloc(0);

        tracerCriacao.add(`Criado um Buffer de 0 bytes para o Command Specific Data do UnRegisterSession`);

        retornoBuff.isSucesso = true;
        retornoBuff.sucesso.buffer = buff;

        return retornoBuff;
    }
}