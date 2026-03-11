import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class ContactDto {
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsNotEmpty()
  @MaxLength(150)
  subject!: string;

  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}

