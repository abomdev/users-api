import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError, DomainErrorKind } from '../domain/domain.error';

/** Formato unico de error, seccion 6 de spec.md. */
interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

const KIND_TO_STATUS: Record<DomainErrorKind, number> = {
  [DomainErrorKind.Conflict]: HttpStatus.CONFLICT,
  [DomainErrorKind.Unauthorized]: HttpStatus.UNAUTHORIZED,
  [DomainErrorKind.Forbidden]: HttpStatus.FORBIDDEN,
  [DomainErrorKind.NotFound]: HttpStatus.NOT_FOUND,
};

/**
 * Texto que acompana a cada codigo, segun la tabla de la seccion 6 de la spec.
 * Es un mapa explicito y no una busqueda inversa sobre el enum de Nest: se lee
 * de un vistazo y no depende de como Nest nombre sus constantes.
 */
const REASON_PHRASES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

/**
 * Frontera unica entre los errores del sistema y lo que ve el cliente.
 *
 * Traduce tres familias distintas a una sola forma de respuesta:
 *  - errores de dominio, segun su `kind`;
 *  - HttpException de Nest (incluida la validacion de DTOs, que llega con
 *    `message` como arreglo);
 *  - cualquier otra cosa, que es un bug y sale como 500 sin filtrar detalles.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildBody(exception, request.url);

    if (body.statusCode >= 500) {
      // El detalle interno se registra, pero nunca viaja al cliente: un stack
      // trace en la respuesta le regala al atacante el mapa del sistema.
      this.logger.error(exception);
    }

    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof DomainError) {
      const statusCode = KIND_TO_STATUS[exception.kind];
      return {
        statusCode,
        error: this.reasonPhrase(statusCode),
        message: exception.message,
        timestamp,
        path,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      // El ValidationPipe empaqueta un mensaje por campo invalido; se conserva
      // el arreglo para que el cliente sepa exactamente que corregir.
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? ((payload as { message: string | string[] }).message ?? exception.message)
          : exception.message;

      return {
        statusCode,
        error: this.reasonPhrase(statusCode),
        message,
        timestamp,
        path,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Ocurrio un error inesperado',
      timestamp,
      path,
    };
  }

  private reasonPhrase(status: number): string {
    return REASON_PHRASES[status] ?? 'Error';
  }
}
